/**
 * SessionStore — plain-text session storage (JSON + JSONL + index).
 * Aligned with Claude Code / Codex Desktop patterns.
 *
 * Path: ~/.atta/seek/sessions/ (global) or <project>/.atta/seek/sessions/ (per-project)
 *
 * All I/O is async (fs/promises). Index read-modify-write operations are
 * serialised through a mutex to prevent lost updates from concurrent writes.
 */

import { mkdir, readFile, writeFile, unlink, readdir, rename } from 'fs/promises'
import { existsSync } from 'fs' // kept sync for cheap existence checks — non-blocking
import { join } from 'path'
import { app } from 'electron'
import type { SessionInfo } from '../../shared/types/AgentTask'

let _baseDir: string | null = null
function baseDir(): string { if (!_baseDir) _baseDir = join(app.getPath('home'), '.atta', 'seek', 'sessions'); return _baseDir }
let _projectDir: string | null = null

export function setProjectSessions(projectRoot: string | null): void {
  _projectDir = projectRoot ? join(projectRoot, '.atta', 'seek', 'sessions') : null
}

function sessionDir(): string { return _projectDir || baseDir() }
function indexPath(): string { return join(sessionDir(), '_index.json') }
function metaPath(id: string): string { return join(sessionDir(), `${id}.json`) }
function eventsPath(id: string): string { return join(sessionDir(), `${id}.jsonl`) }
function archiveDir(): string { return join(sessionDir(), 'archive') }

async function ensureDir(): Promise<void> {
  const d = sessionDir()
  if (!existsSync(d)) await mkdir(d, { recursive: true })
}

// ── Index mutex (prevents lost updates in concurrent read-modify-write) ──

import { withMutex } from './mutex'
const withIndexLock = withMutex

// ── Index ──

async function loadIndex(): Promise<SessionInfo[]> {
  try { const raw = await readFile(indexPath(), 'utf-8'); return JSON.parse(raw) as SessionInfo[] }
  catch (e) { console.warn('[SessionStore] failed to load index:', e instanceof Error ? e.message : String(e)); return [] }
}
async function saveIndex(sessions: SessionInfo[]): Promise<void> {
  await ensureDir(); await writeFile(indexPath(), JSON.stringify(sessions))
}

// ── CRUD ──

export async function createSession(id: string, title: string, activity: string, projectId: string | null = null): Promise<SessionInfo> {
  await ensureDir()
  const now = Date.now()
  const s: SessionInfo = { id, title, activity, projectId, createdAt: now, updatedAt: now }

  // Check for existing session — dedup (multi-turn conversations call createSession
  // for the same temp session ID on every message; we must not duplicate in the index).
  const existing = await withIndexLock(async () => {
    const idx = await loadIndex()
    const found = idx.find(x => x.id === id)
    if (found) {
      // Session exists — only bump timestamp, never overwrite title.
      // Title is set once by the first SessionTitleGenerated; follow-up
      // messages must not clobber it.
      found.updatedAt = now
      await saveIndex(idx)
    } else {
      idx.unshift(s)
      await saveIndex(idx)
    }
    return found
  })

  // Write (or overwrite) meta file with latest data
  await writeFile(metaPath(id), JSON.stringify(existing || s))
  return existing || s
}

export async function getSession(id: string): Promise<SessionInfo | null> {
  try { const raw = await readFile(metaPath(id), 'utf-8'); return JSON.parse(raw) as SessionInfo }
  catch (e) { console.warn('[SessionStore] failed to read session meta:', e instanceof Error ? e.message : String(e)); return null }
}

export async function listSessions(activity?: string, projectId?: string | null): Promise<SessionInfo[]> {
  const idx = await loadIndex()
  let result = idx
  if (activity) result = result.filter(s => s.activity === activity)
  if (projectId !== undefined) result = result.filter(s => s.projectId === projectId)
  return result
}

export async function updateSession(id: string, patch: { title?: string }): Promise<SessionInfo | null> {
  const s = await getSession(id); if (!s) return null
  if (patch.title) s.title = patch.title
  s.updatedAt = Date.now()
  await writeFile(metaPath(id), JSON.stringify(s))
  await withIndexLock(async () => {
    const idx = await loadIndex()
    const i = idx.findIndex(x => x.id === id)
    if (i >= 0) { idx[i] = s; await saveIndex(idx) }
  })
  return s
}

export async function deleteSession(id: string): Promise<boolean> {
  try {
    await unlink(metaPath(id))
    try { await unlink(eventsPath(id)) } catch { /* events file may not exist */ }
    await withIndexLock(async () => {
      const idx = (await loadIndex()).filter(s => s.id !== id)
      await saveIndex(idx)
    })
    return true
  } catch (e) { console.warn('[SessionStore] failed to delete session:', e instanceof Error ? e.message : String(e)); return false }
}

// ── Events (JSONL) ──

let _lastIndexFlush = 0
const INDEX_FLUSH_INTERVAL_MS = 10000 // throttle index rewrites to every 10s during streaming

export async function appendEvent(sessionId: string, event: unknown): Promise<void> {
  return appendEvents(sessionId, [event])
}

/** Batch-append multiple events in a single write — avoids N+1 I/O in save-events. */
export async function appendEvents(sessionId: string, events: unknown[]): Promise<void> {
  if (events.length === 0) return
  await ensureDir()
  const lines = events.map(e => JSON.stringify(e) + '\n').join('')
  try { await writeFile(eventsPath(sessionId), lines, { flag: 'a' }) }
  catch (e) { console.warn('[SessionStore] failed to append events:', e instanceof Error ? e.message : String(e)) }
  // Update session timestamp; throttle index rewrites to avoid I/O on every event
  const now = Date.now()
  if (now - _lastIndexFlush < INDEX_FLUSH_INTERVAL_MS) return
  await withIndexLock(async () => {
    const idx = await loadIndex(); const i = idx.findIndex(s => s.id === sessionId)
    if (i >= 0) {
      idx[i].updatedAt = now
      await saveIndex(idx)
      _lastIndexFlush = now
    }
  })
}

export async function readEvents(sessionId: string): Promise<unknown[]> {
  try {
    const raw = await readFile(eventsPath(sessionId), 'utf-8')
    return raw.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line) } catch { return null } }).filter(Boolean)
  } catch (e) { console.warn('[SessionStore] failed to read events:', e instanceof Error ? e.message : String(e)); return [] }
}

// ── Archive ──

export async function archiveOldSessions(maxAgeDays: number = 30): Promise<number> {
  const cutoff = Date.now() - maxAgeDays * 86400000
  let count = 0
  await withIndexLock(async () => {
    const idx = await loadIndex()
    const remaining: SessionInfo[] = []
    for (const s of idx) {
      if (s.updatedAt < cutoff) {
        const ad = archiveDir()
        if (!existsSync(ad)) await mkdir(ad, { recursive: true })
        try { await rename(metaPath(s.id), join(ad, `${s.id}.json`)); count++ } catch (e) { console.warn('[SessionStore] archive rename failed:', e instanceof Error ? e.message : String(e)); remaining.push(s) }
        try { await unlink(eventsPath(s.id)) } catch { /* events file may not exist */ }
      } else { remaining.push(s) }
    }
    if (count > 0) await saveIndex(remaining)
  })
  return count
}
