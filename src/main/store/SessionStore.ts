/**
 * SessionStore — plain-text session storage (JSON + JSONL + index).
 * Aligned with Claude Code / Codex Desktop patterns.
 *
 * Path: ~/.atta/seek/sessions/ (global) or <project>/.atta/seek/sessions/ (per-project)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, renameSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export interface SessionInfo { id: string; title: string; activity: string; createdAt: number; updatedAt: number }

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

function ensureDir(): void { const d = sessionDir(); if (!existsSync(d)) mkdirSync(d, { recursive: true }) }

// ── Index ──

function loadIndex(): SessionInfo[] {
  try { return JSON.parse(readFileSync(indexPath(), 'utf-8')) as SessionInfo[] }
  catch { return [] }
}
function saveIndex(sessions: SessionInfo[]): void {
  ensureDir(); writeFileSync(indexPath(), JSON.stringify(sessions))
}

// ── CRUD ──

export function createSession(id: string, title: string, activity: string): SessionInfo {
  ensureDir()
  const now = Date.now()
  const s: SessionInfo = { id, title, activity, createdAt: now, updatedAt: now }
  writeFileSync(metaPath(id), JSON.stringify(s))
  const idx = loadIndex()
  idx.unshift(s)
  saveIndex(idx)
  return s
}

export function getSession(id: string): SessionInfo | null {
  try { return JSON.parse(readFileSync(metaPath(id), 'utf-8')) as SessionInfo }
  catch { return null }
}

export function listSessions(activity?: string): SessionInfo[] {
  const idx = loadIndex()
  return activity ? idx.filter(s => s.activity === activity) : idx
}

export function updateSession(id: string, patch: { title?: string }): SessionInfo | null {
  const s = getSession(id); if (!s) return null
  if (patch.title) s.title = patch.title
  s.updatedAt = Date.now()
  writeFileSync(metaPath(id), JSON.stringify(s))
  const idx = loadIndex()
  const i = idx.findIndex(x => x.id === id)
  if (i >= 0) { idx[i] = s; saveIndex(idx) }
  return s
}

export function deleteSession(id: string): boolean {
  try {
    unlinkSync(metaPath(id))
    try { unlinkSync(eventsPath(id)) } catch { /* jsonl may not exist */ }
    const idx = loadIndex().filter(s => s.id !== id)
    saveIndex(idx)
    return true
  } catch { return false }
}

// ── Events (JSONL) ──

export function appendEvent(sessionId: string, event: unknown): void {
  ensureDir()
  const line = JSON.stringify(event) + '\n'
  try { writeFileSync(eventsPath(sessionId), line, { flag: 'a' }) }
  catch { /* best effort */ }
  // Update session timestamp
  const idx = loadIndex(); const i = idx.findIndex(s => s.id === sessionId)
  if (i >= 0) { idx[i].updatedAt = Date.now(); saveIndex(idx) }
}

export function readEvents(sessionId: string): unknown[] {
  try {
    const raw = readFileSync(eventsPath(sessionId), 'utf-8')
    return raw.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line) } catch { return null } }).filter(Boolean)
  } catch { return [] }
}

// ── Archive ──

export function archiveOldSessions(maxAgeDays: number = 30): number {
  const cutoff = Date.now() - maxAgeDays * 86400000
  const idx = loadIndex(); let count = 0
  const remaining: SessionInfo[] = []
  for (const s of idx) {
    if (s.updatedAt < cutoff) {
      const ad = archiveDir(); if (!existsSync(ad)) mkdirSync(ad, { recursive: true })
      try { renameSync(metaPath(s.id), join(ad, `${s.id}.json`)); count++ } catch { remaining.push(s) }
      try { unlinkSync(eventsPath(s.id)) } catch { /* no events */ }
    } else { remaining.push(s) }
  }
  if (count > 0) saveIndex(remaining)
  return count
}
