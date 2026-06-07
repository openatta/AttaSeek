/**
 * MemoryService — L1 scratchpad (per-session, in-memory) + L2 persistent (SQLite).
 */

import { getDb, dbQuery, dbQueryOne } from '../store/db'
import { newId } from '../store/id'
import { fromRow } from '../store/util'
import type { MemoryEntry, MemoryQuery } from '../../shared/types/Memory'

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
    return dbQuery<Record<string, unknown>>(sql, ...params).map((r) => fromRow<MemoryEntry>(r)!).filter((e): e is MemoryEntry => !!e)
  }

  get(id: string): MemoryEntry | undefined { return fromRow<MemoryEntry>(dbQueryOne<Record<string, unknown>>('SELECT * FROM memory_entries WHERE id = ?', id)) }

  update(id: string, patch: Partial<Pick<MemoryEntry, 'content' | 'scope' | 'scopeId' | 'type'>>): MemoryEntry | null {
    const ex = dbQueryOne<Record<string, unknown>>('SELECT * FROM memory_entries WHERE id = ?', id)
    if (!ex) return null
    const c = patch.content ?? ex.content; const sc = patch.scope ?? ex.scope; const si = patch.scopeId ?? ex.scope_id; const t = patch.type ?? ex.type; const now = Date.now()
    const db = getDb()
    db.prepare('UPDATE memory_entries SET content=?, scope=?, scope_id=?, type=?, updated_at=? WHERE id=?').run(c, sc, si, t, now, id)
    return fromRow<MemoryEntry>({ ...ex, content: c, scope: sc, scope_id: si, type: t, updated_at: now }) || null
  }

  delete(id: string): boolean { return getDb().prepare('DELETE FROM memory_entries WHERE id=?').run(id).changes > 0 }

  listAll(): MemoryEntry[] { return dbQuery<Record<string, unknown>>('SELECT * FROM memory_entries ORDER BY updated_at DESC LIMIT 200').map((r) => fromRow<MemoryEntry>(r)!).filter((e): e is MemoryEntry => !!e) }

  get count(): number { return dbQueryOne<{ c: number }>('SELECT COUNT(*) as c FROM memory_entries')?.c || 0 }
}

export const memoryService = new MemoryService()
