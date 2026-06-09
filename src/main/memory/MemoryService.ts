/**
 * MemoryService — L1 scratchpad (per-session, in-memory) + L2 persistent (JSONL).
 * Stored at ~/.atta/seek/memories.jsonl.
 */

import { JSONLStore } from '../store/FileStore'
import { newId } from '../store/id'
import { dataDir } from '../store/paths'
import type { MemoryEntry, MemoryQuery } from '../../shared/types/Memory'

const store = new JSONLStore(`${dataDir()}/memories.jsonl`)

export class MemoryService {
  private scratchpads = new Map<string, Map<string, unknown>>()

  // --- L1: Session Scratchpad ---
  getScratchpad(sid: string, key: string): unknown { return this.scratchpads.get(sid)?.get(key) }
  setScratchpad(sid: string, key: string, value: unknown): void {
    if (!this.scratchpads.has(sid)) this.scratchpads.set(sid, new Map())
    this.scratchpads.get(sid)!.set(key, value)
  }
  clearScratchpad(sid: string): void { this.scratchpads.delete(sid) }

  // --- L2: Persistent Memory (JSONL) ---

  async store(entry: Omit<MemoryEntry, 'id' | 'layer' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry> {
    const id = `mem_${newId().slice(0, 8)}`
    const now = Date.now()
    const mem: MemoryEntry = { id, layer: 'L2', ...entry, createdAt: now, updatedAt: now }
    await store.append(mem)
    return mem
  }

  async recall(query: MemoryQuery): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = []
    for await (const e of store.read()) {
      const m = e as MemoryEntry
      if (query.scope && m.scope !== query.scope) continue
      if (query.scopeId && m.scopeId !== query.scopeId) continue
      if (query.type && m.type !== query.type) continue
      if (query.layer && m.layer !== query.layer) continue
      if (query.query && !m.content.toLowerCase().includes(query.query.toLowerCase())) continue
      results.push(m)
    }
    results.sort((a, b) => b.updatedAt - a.updatedAt)
    if (query.limit) return results.slice(0, query.limit)
    return results
  }

  async get(id: string): Promise<MemoryEntry | undefined> {
    for await (const e of store.read()) {
      if ((e as MemoryEntry).id === id) return e as MemoryEntry
    }
    return undefined
  }

  async update(id: string, patch: Partial<Pick<MemoryEntry, 'content' | 'scope' | 'scopeId' | 'type'>>): Promise<MemoryEntry | null> {
    // Read all entries, find and update the target, rewrite
    const all: MemoryEntry[] = []
    for await (const e of store.read()) all.push(e as MemoryEntry)
    const idx = all.findIndex(m => m.id === id)
    if (idx === -1) return null
    const now = Date.now()
    if (patch.content !== undefined) all[idx].content = patch.content
    if (patch.scope !== undefined) all[idx].scope = patch.scope
    if (patch.scopeId !== undefined) all[idx].scopeId = patch.scopeId
    if (patch.type !== undefined) all[idx].type = patch.type
    all[idx].updatedAt = now
    // Rewrite file (JSONL doesn't support in-place updates)
    const { writeFileSync } = await import('fs')
    const { dataDir: dd } = await import('../store/paths')
    const { join } = await import('path')
    writeFileSync(join(dd(), 'memories.jsonl'), all.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf-8')
    return all[idx]
  }

  async delete(id: string): Promise<boolean> {
    const all: MemoryEntry[] = []
    let found = false
    for await (const e of store.read()) {
      if ((e as MemoryEntry).id === id) { found = true; continue }
      all.push(e as MemoryEntry)
    }
    if (!found) return false
    const { writeFileSync } = await import('fs')
    const { dataDir: dd } = await import('../store/paths')
    const { join } = await import('path')
    writeFileSync(join(dd(), 'memories.jsonl'), all.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf-8')
    return true
  }

  async listAll(): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = []
    for await (const e of store.read()) results.push(e as MemoryEntry)
    return results.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 200)
  }

  async count(): Promise<number> {
    let n = 0
    for await (const _ of store.read()) n++
    return n
  }
}

export const memoryService = new MemoryService()
