/**
 * TaskStore — SQLite-persisted task storage for agent task management tools.
 *
 * Replaces the in-memory array in task-mgmt.ts with durable storage
 * that survives restarts and session boundaries.
 */

import { getDb, dbQuery, dbQueryOne } from './db'

export interface StoredTask {
  id: string
  title: string
  status: string
  sessionId: string
  goal: string
  output?: string
  createdAt: number
  updatedAt: number
}

/** Ensure the tasks table exists (idempotent) */
function ensureTable(): void {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      session_id TEXT NOT NULL DEFAULT '',
      goal TEXT NOT NULL DEFAULT '',
      output TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    )
  `)
}

function rowToTask(row: Record<string, unknown>): StoredTask {
  return {
    id: row.id as string,
    title: row.title as string,
    status: row.status as string,
    sessionId: row.session_id as string,
    goal: row.goal as string,
    output: row.output as string | undefined,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  }
}

export const TaskStore = {
  create(params: { subject?: string; title?: string; description?: string; goal?: string; sessionId?: string }): StoredTask {
    ensureTable()
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const title = params.subject || params.title || ''
    const goal = params.description || params.goal || ''
    const sessionId = params.sessionId || ''
    const now = Date.now()

    const db = getDb()
    db.prepare(
      'INSERT INTO agent_tasks (id, title, status, session_id, goal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, title, 'pending', sessionId, goal, now, now)

    return { id, title, status: 'pending', sessionId, goal, createdAt: now, updatedAt: now }
  },

  update(taskId: string, patch: { status?: string; title?: string; output?: string }): StoredTask | null {
    ensureTable()
    const existing = this.get(taskId)
    if (!existing) return null

    const status = patch.status ?? existing.status
    const title = patch.title ?? existing.title
    const output = patch.output ?? existing.output
    const now = Date.now()

    const db = getDb()
    db.prepare(
      'UPDATE agent_tasks SET status = ?, title = ?, output = ?, updated_at = ? WHERE id = ?',
    ).run(status, title, output, now, taskId)

    return { ...existing, status, title, output, updatedAt: now }
  },

  get(taskId: string): StoredTask | null {
    ensureTable()
    const row = dbQueryOne<Record<string, unknown>>('SELECT * FROM agent_tasks WHERE id = ?', taskId)
    return row ? rowToTask(row) : null
  },

  list(sessionId?: string): StoredTask[] {
    ensureTable()
    const rows = sessionId
      ? dbQuery<Record<string, unknown>>('SELECT * FROM agent_tasks WHERE session_id = ? ORDER BY created_at DESC', sessionId)
      : dbQuery<Record<string, unknown>>('SELECT * FROM agent_tasks ORDER BY created_at DESC')
    return rows.map(rowToTask)
  },

  delete(taskId: string): boolean {
    ensureTable()
    const db = getDb()
    const result = db.prepare('DELETE FROM agent_tasks WHERE id = ?').run(taskId)
    return result.changes > 0
  },

  /** Clear all tasks (e.g., on app quit if needed) */
  clear(): void {
    ensureTable()
    const db = getDb()
    db.prepare('DELETE FROM agent_tasks').run()
  },
}
