/**
 * MemoryService — L1 scratchpad (per-session, in-memory) + L2 persistent (SQLite).
 */

import { getDb } from '../store/db'
import { newId } from '../store/id'
import type { MemoryEntry, MemoryQuery } from '../../renderer/core/types/Memory'

export class MemoryService {
  private scratchpads = new Map<string, Map<string, unknown>>()

  // --- L1: Session Scratchpad ---
  getScratchpad(sid: string, key: string): unknown { return this.scratchpads.get(sid)?.get(key) }
  setScratchpad(sid: string, key: string, value: unknown): void {
    if (!this.scratchpads.has(sid)) this.scratchpads.set(sid, new Map())
    this.scratchpads.get(sid)!.set(key, value)
  }
  clearScratchpad(sid: string): void { this.scratchpads.delete(sid) }

  // --- L2: Persistent Memory (SQLite) ---
  store(entry: Omit<MemoryEntry, 'id' | 'layer' | 'createdAt' | 'updatedAt'>): MemoryEntry {
    const db = getDb()
    const id = `mem_${newId().slice(0, 8)}`
    const now = Date.now()
    db.prepare(`INSERT INTO memory_entries (id, layer, scope, scope_id, type, content, source, session_id, task_id, created_at, updated_at)
      VALUES (?, 'L2', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, entry.scope, entry.scopeId, entry.type, entry.content, entry.source, entry.sessionId || null, entry.taskId || null, now, now)
    return { id, layer: 'L2', ...entry, createdAt: now, updatedAt: now }
  }

  recall(query: MemoryQuery): MemoryEntry[] {
    const db = getDb()
    let sql = 'SELECT * FROM memory_entries WHERE 1=1'
    const params: any[] = []
    if (query.scope) { sql += ' AND scope = ?'; params.push(query.scope) }
    if (query.scopeId) { sql += ' AND scope_id = ?'; params.push(query.scopeId) }
    if (query.type) { sql += ' AND type = ?'; params.push(query.type) }
    if (query.layer) { sql += ' AND layer = ?'; params.push(query.layer) }
    if (query.query) { sql += ' AND content LIKE ?'; params.push(`%${query.query}%`) }
    sql += ' ORDER BY updated_at DESC'
    if (query.limit) { sql += ' LIMIT ?'; params.push(query.limit) }
    return (db.prepare(sql).all(...params) as any[]).map((r: any) => this.rowToEntry(r)).filter((e): e is MemoryEntry => !!e)
  }

  get(id: string): MemoryEntry | undefined { return this.rowToEntry(getDb().prepare('SELECT * FROM memory_entries WHERE id = ?').get(id) as any) }

  update(id: string, patch: Partial<Pick<MemoryEntry, 'content' | 'scope' | 'scopeId' | 'type'>>): MemoryEntry | null {
    const db = getDb(); const ex = db.prepare('SELECT * FROM memory_entries WHERE id = ?').get(id) as any
    if (!ex) return null
    const c = patch.content ?? ex.content; const sc = patch.scope ?? ex.scope; const si = patch.scopeId ?? ex.scope_id; const t = patch.type ?? ex.type; const now = Date.now()
    db.prepare('UPDATE memory_entries SET content=?, scope=?, scope_id=?, type=?, updated_at=? WHERE id=?').run(c, sc, si, t, now, id)
    return this.rowToEntry({ ...ex, content: c, scope: sc, scope_id: si, type: t, updated_at: now }) || null
  }

  delete(id: string): boolean { return getDb().prepare('DELETE FROM memory_entries WHERE id=?').run(id).changes > 0 }

  listAll(): MemoryEntry[] { return (getDb().prepare('SELECT * FROM memory_entries ORDER BY updated_at DESC').all() as any[]).map((r: any) => this.rowToEntry(r)).filter((e): e is MemoryEntry => !!e) }

  get count(): number { return (getDb().prepare('SELECT COUNT(*) as c FROM memory_entries').get() as any)?.c || 0 }

  private rowToEntry(r: any): MemoryEntry | undefined {
    if (!r) return undefined
    return { id: r.id, layer: r.layer, scope: r.scope, scopeId: r.scope_id, type: r.type, content: r.content, source: r.source, sessionId: r.session_id, taskId: r.task_id, createdAt: r.created_at, updatedAt: r.updated_at }
  }
}

export const memoryService = new MemoryService()
