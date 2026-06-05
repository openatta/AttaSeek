/**
 * IPC handlers for session:* channels.
 * Manages session CRUD and persistence.
 */

import { ipcMain } from 'electron'
import { getDb } from '../store/db'
import { newId } from '../store/id'
import { agentEventBus } from '../agent/AgentEventBus'
import { ipcWrap, validateRequiredString } from '../store/util'

export function registerSessionHandlers(): void {
  // Create a new session (id is optional — if provided, use it; otherwise generate)
  ipcMain.handle('session:create', async (_e, p: { title?: string; activity?: string; id?: string }) => {
    return ipcWrap(() => {
      const db = getDb()
      const id = p.id || newId()
      const now = Date.now()
      const title = p.title || 'New Session'
      const activity = p.activity || 'chat'
      // Use INSERT OR IGNORE to handle duplicate IDs gracefully
      db.prepare('INSERT OR IGNORE INTO sessions (id, title, activity, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, title, activity, now, now)
      return { session: { id, title, activity, createdAt: now, updatedAt: now } }
    })
  })

  // List all sessions
  ipcMain.handle('session:list', async () => {
    return ipcWrap(() => {
      const db = getDb()
      const sessions = db
        .prepare('SELECT * FROM sessions ORDER BY updated_at DESC')
        .all() as any[]
      return {
        sessions: sessions.map((r: any) => ({
          id: r.id,
          title: r.title,
          activity: r.activity,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      }
    })
  })

  // Get a session by ID
  ipcMain.handle('session:get', async (_e, p: { id: string }) => {
    validateRequiredString(p, 'id', 'id')
    return ipcWrap(() => {
      const db = getDb()
      const r = db.prepare('SELECT * FROM sessions WHERE id = ?').get(p.id) as any
      if (!r) return { session: null }
      return {
        session: {
          id: r.id,
          title: r.title,
          activity: r.activity,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        },
      }
    })
  })

  // Delete a session
  ipcMain.handle('session:delete', async (_e, p: { id: string }) => {
    validateRequiredString(p, 'id', 'id')
    return ipcWrap(() => {
      const db = getDb()
      // Clean up related data
      agentEventBus.clearHistory(p.id)
      db.prepare('DELETE FROM session_events WHERE session_id = ?').run(p.id)
      db.prepare('DELETE FROM artifacts WHERE session_id = ?').run(p.id)
      db.prepare('DELETE FROM memory_entries WHERE session_id = ?').run(p.id)
      db.prepare('DELETE FROM audit_logs WHERE session_id = ?').run(p.id)
      const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(p.id)
      return { success: result.changes > 0 }
    })
  })

  // Update session title
  ipcMain.handle('session:update', async (_e, p: { id: string; title?: string; activity?: string }) => {
    validateRequiredString(p, 'id', 'id')
    return ipcWrap(() => {
      const db = getDb()
      const now = Date.now()
      const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(p.id) as any
      if (!row) return { session: null }
      const title = p.title ?? row.title
      const activity = p.activity ?? row.activity
      db.prepare('UPDATE sessions SET title = ?, activity = ?, updated_at = ? WHERE id = ?').run(
        title,
        activity,
        now,
        p.id,
      )
      return { session: { id: p.id, title, activity, createdAt: row.created_at, updatedAt: now } }
    })
  })

  // Save session events (for persistence)
  ipcMain.handle('session:save-events', async (_e, p: { sessionId: string }) => {
    validateRequiredString(p, 'sessionId', 'sessionId')
    return ipcWrap(() => {
      const db = getDb()
      const events = agentEventBus.getHistory(p.sessionId)
      const insert = db.prepare(
        'INSERT OR REPLACE INTO session_events (id, session_id, task_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      const tx = db.transaction(() => {
        for (const event of events) {
          insert.run(event.id, event.sessionId, event.taskId, event.type, JSON.stringify(event.payload), event.createdAt)
        }
      })
      tx()
      return { success: true, count: events.length }
    })
  })

  // Load session events (on restore)
  ipcMain.handle('session:load-events', async (_e, p: { sessionId: string }) => {
    validateRequiredString(p, 'sessionId', 'sessionId')
    return ipcWrap(() => {
      const db = getDb()
      const rows = db
        .prepare('SELECT * FROM session_events WHERE session_id = ? ORDER BY created_at ASC')
        .all(p.sessionId) as any[]
      const events = rows.map((r: any) => ({
        id: r.id,
        sessionId: r.session_id,
        taskId: r.task_id,
        type: r.type,
        payload: JSON.parse(r.payload),
        createdAt: r.created_at,
      }))
      return { events }
    })
  })

  console.log('[IPC:session] handlers registered')
}
