/**
 * TerminalStore — file-based persistence for terminal sessions, profiles, and bookmarks.
 *
 * Stored under ~/.atta/seek/terminals/ as individual JSON files.
 */

import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { dataDir } from './paths'
import { newId } from './id'

// ── Types ──

export interface TerminalSession {
  id: string
  /** Working directory when terminal was created */
  cwd: string
  /** Human-readable label */
  label?: string
  /** When the session was created */
  createdAt: number
  /** When the session was last active */
  lastActiveAt: number
  /** Whether the terminal process is still alive (may be restored on next launch) */
  isAlive: boolean
  /** Shell used (e.g., /bin/zsh) */
  shell: string
}

export interface TerminalProfile {
  id: string
  name: string
  cwd: string
  /** Optional command to run after terminal starts (e.g., "npm run dev") */
  initialCommand?: string
  /** Shell override — if not set, uses system default */
  shell?: string
  /** Environment variables to set */
  env?: Record<string, string>
  /** Sort order in the profile picker */
  order: number
  createdAt: number
  updatedAt: number
}

export interface TerminalBookmark {
  id: string
  /** Working directory */
  cwd: string
  /** Short description */
  label: string
  createdAt: number
}

// ── Store paths ──

function terminalsDir(): string {
  return join(dataDir(), 'terminals')
}

function ensureDir(): void {
  const dir = terminalsDir()
  if (!existsSync(dir)) {
    // mkdirSync in ensureDir is called during startup, before async availability
    const { mkdirSync } = require('fs')
    mkdirSync(dir, { recursive: true })
  }
}

// ── Session persistence ──

const SESSIONS_FILE = 'sessions.json'

async function readSessions(): Promise<TerminalSession[]> {
  ensureDir()
  try {
    const raw = await readFile(join(terminalsDir(), SESSIONS_FILE), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeSessions(sessions: TerminalSession[]): Promise<void> {
  ensureDir()
  await writeFile(join(terminalsDir(), SESSIONS_FILE), JSON.stringify(sessions, null, 2))
}

export const terminalStore = {
  // ── Sessions ──

  async saveSession(session: Omit<TerminalSession, 'id' | 'createdAt'>): Promise<TerminalSession> {
    const sessions = await readSessions()
    const now = Date.now()
    const entry: TerminalSession = {
      id: `term_${newId().slice(0, 8)}`,
      ...session,
      createdAt: now,
    }
    sessions.push(entry)
    // Keep max 50 sessions
    if (sessions.length > 50) {
      sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      sessions.length = 50
    }
    await writeSessions(sessions)
    return entry
  },

  async updateSession(id: string, updates: Partial<Pick<TerminalSession, 'isAlive' | 'lastActiveAt' | 'label'>>): Promise<TerminalSession | null> {
    const sessions = await readSessions()
    const idx = sessions.findIndex(s => s.id === id)
    if (idx === -1) return null
    sessions[idx] = { ...sessions[idx], ...updates }
    await writeSessions(sessions)
    return sessions[idx]
  },

  async listSessions(limit = 20): Promise<TerminalSession[]> {
    const sessions = await readSessions()
    return sessions
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .slice(0, limit)
  },

  async getLastSession(): Promise<TerminalSession | null> {
    const sessions = await readSessions()
    if (sessions.length === 0) return null
    return sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0]
  },

  async deleteSession(id: string): Promise<boolean> {
    const sessions = await readSessions()
    const filtered = sessions.filter(s => s.id !== id)
    if (filtered.length === sessions.length) return false
    await writeSessions(filtered)
    return true
  },

  // ── Profiles ──

  async listProfiles(): Promise<TerminalProfile[]> {
    ensureDir()
    try {
      const raw = await readFile(join(terminalsDir(), 'profiles.json'), 'utf-8')
      return JSON.parse(raw)
    } catch {
      return []
    }
  },

  async saveProfile(profile: Omit<TerminalProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<TerminalProfile> {
    const profiles = await this.listProfiles()
    const now = Date.now()
    const entry: TerminalProfile = {
      id: `tprof_${newId().slice(0, 8)}`,
      ...profile,
      createdAt: now,
      updatedAt: now,
    }
    profiles.push(entry)
    await writeFile(join(terminalsDir(), 'profiles.json'), JSON.stringify(profiles, null, 2))
    return entry
  },

  async updateProfile(id: string, updates: Partial<Omit<TerminalProfile, 'id' | 'createdAt'>>): Promise<TerminalProfile | null> {
    const profiles = await this.listProfiles()
    const idx = profiles.findIndex(p => p.id === id)
    if (idx === -1) return null
    profiles[idx] = { ...profiles[idx], ...updates, updatedAt: Date.now() }
    await writeFile(join(terminalsDir(), 'profiles.json'), JSON.stringify(profiles, null, 2))
    return profiles[idx]
  },

  async deleteProfile(id: string): Promise<boolean> {
    const profiles = await this.listProfiles()
    const filtered = profiles.filter(p => p.id !== id)
    if (filtered.length === profiles.length) return false
    await writeFile(join(terminalsDir(), 'profiles.json'), JSON.stringify(filtered, null, 2))
    return true
  },

  // ── Bookmarks ──

  async listBookmarks(): Promise<TerminalBookmark[]> {
    ensureDir()
    try {
      const raw = await readFile(join(terminalsDir(), 'bookmarks.json'), 'utf-8')
      return JSON.parse(raw)
    } catch {
      return []
    }
  },

  async saveBookmark(bookmark: Omit<TerminalBookmark, 'id' | 'createdAt'>): Promise<TerminalBookmark> {
    const bookmarks = await this.listBookmarks()
    const entry: TerminalBookmark = {
      id: `tbkm_${newId().slice(0, 8)}`,
      ...bookmark,
      createdAt: Date.now(),
    }
    bookmarks.push(entry)
    await writeFile(join(terminalsDir(), 'bookmarks.json'), JSON.stringify(bookmarks, null, 2))
    return entry
  },

  async deleteBookmark(id: string): Promise<boolean> {
    const bookmarks = await this.listBookmarks()
    const filtered = bookmarks.filter(b => b.id !== id)
    if (filtered.length === bookmarks.length) return false
    await writeFile(join(terminalsDir(), 'bookmarks.json'), JSON.stringify(filtered, null, 2))
    return true
  },
}
