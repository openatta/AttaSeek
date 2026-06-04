/**
 * MemoryService — L1 scratchpad (per-session, in-memory) + L2 persistent memory.
 * MVP: all storage is in-memory. Phase 5+: L2 backed by SQLite + vector search.
 */

import type { MemoryEntry, MemoryLayer, MemoryQuery, MemoryScope, MemoryType } from '../../renderer/core/types/Memory'

export class MemoryService {
  private scratchpads: Map<string, Map<string, unknown>> = new Map() // L1: sessionId -> key/val
  private entries: MemoryEntry[] = [] // L2: persistent memory
  private nextId = 1

  // --- L1: Session Scratchpad ---

  getScratchpad(sessionId: string, key: string): unknown {
    return this.scratchpads.get(sessionId)?.get(key)
  }

  setScratchpad(sessionId: string, key: string, value: unknown): void {
    if (!this.scratchpads.has(sessionId)) {
      this.scratchpads.set(sessionId, new Map())
    }
    this.scratchpads.get(sessionId)!.set(key, value)
  }

  clearScratchpad(sessionId: string): void {
    this.scratchpads.delete(sessionId)
  }

  getAllScratchpad(sessionId: string): Record<string, unknown> {
    const pad = this.scratchpads.get(sessionId)
    if (!pad) return {}
    return Object.fromEntries(pad)
  }

  // --- L2: Persistent Memory ---

  store(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): MemoryEntry {
    const now = Date.now()
    const stored: MemoryEntry = {
      ...entry,
      id: `mem_${this.nextId++}`,
      layer: 'L2',
      createdAt: now,
      updatedAt: now,
    }
    this.entries.push(stored)
    return stored
  }

  recall(query: MemoryQuery): MemoryEntry[] {
    let results = [...this.entries]

    if (query.scope) results = results.filter((e) => e.scope === query.scope)
    if (query.scopeId) results = results.filter((e) => e.scopeId === query.scopeId)
    if (query.type) results = results.filter((e) => e.type === query.type)
    if (query.layer) results = results.filter((e) => e.layer === query.layer)

    if (query.query) {
      const q = query.query.toLowerCase()
      results = results.filter((e) => e.content.toLowerCase().includes(q))
    }

    results.sort((a, b) => b.updatedAt - a.updatedAt)
    if (query.limit) results = results.slice(0, query.limit)

    return results
  }

  get(id: string): MemoryEntry | undefined {
    return this.entries.find((e) => e.id === id)
  }

  update(id: string, patch: Partial<Pick<MemoryEntry, 'content' | 'scope' | 'scopeId' | 'type'>>): MemoryEntry | null {
    const entry = this.get(id)
    if (!entry) return null
    Object.assign(entry, patch, { updatedAt: Date.now() })
    return entry
  }

  delete(id: string): boolean {
    const idx = this.entries.findIndex((e) => e.id === id)
    if (idx === -1) return false
    this.entries.splice(idx, 1)
    return true
  }

  /** List all L2 entries (for settings UI) */
  listAll(): MemoryEntry[] {
    return [...this.entries].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  get count(): number {
    return this.entries.length
  }
}

/** Singleton */
export const memoryService = new MemoryService()
