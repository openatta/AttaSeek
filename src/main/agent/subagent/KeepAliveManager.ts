/**
 * KeepAliveManager — manages worker keep-alive lifecycle.
 *
 * After a sub-agent completes, its QueryEngine is preserved in "keep-alive"
 * state for a TTL window, enabling efficient continuation via injectAndContinue.
 *
 * Extracted from SubAgentManager to separate lifecycle concerns.
 */

import type { QueryEngine } from '../orchestrator/QueryEngine'
import type { AgentProfile } from '../profile/AgentProfile'

/** TTL for keep-alive workers — engine preserved for continuation after completion. */
const KEEP_ALIVE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Maximum keep-alive workers before oldest is evicted. */
const MAX_KEEP_ALIVE_WORKERS = 3

export interface KeepAliveEntry {
  engine: QueryEngine
  agentId: string
  keepAlive: boolean
  keepAliveUntil?: number
  cleanupTimer?: ReturnType<typeof setTimeout>
  profile?: AgentProfile
}

export class KeepAliveManager {
  private entries = new Map<string, KeepAliveEntry>()

  /** Enter keep-alive: preserve the engine, set TTL, evict oldest if at capacity. */
  enter(agentId: string, entry: KeepAliveEntry): void {
    // Evict expired keep-alive entries first
    for (const [id, e] of this.entries) {
      if (e.keepAlive && this.isExpired(e)) {
        this.evict(id, e)
      }
    }

    // If still at capacity, evict the oldest keep-alive
    const aliveEntries = Array.from(this.entries.entries())
      .filter(([, e]) => e.keepAlive)
    if (aliveEntries.length >= MAX_KEEP_ALIVE_WORKERS) {
      aliveEntries.sort(([, a], [, b]) => (a.keepAliveUntil || 0) - (b.keepAliveUntil || 0))
      const [oldestId] = aliveEntries[0]!
      const oldestEntry = this.entries.get(oldestId)
      if (oldestEntry) this.evict(oldestId, oldestEntry)
    }

    entry.keepAlive = true
    entry.keepAliveUntil = Date.now() + KEEP_ALIVE_TTL_MS

    // Set the cleanup timer
    if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer)
    entry.cleanupTimer = setTimeout(() => {
      const current = this.entries.get(agentId)
      if (current?.keepAlive) {
        this.evict(agentId, current)
      }
    }, KEEP_ALIVE_TTL_MS)
  }

  /** Check if a keep-alive entry has expired. */
  isExpired(entry: KeepAliveEntry): boolean {
    return entry.keepAliveUntil ? Date.now() > entry.keepAliveUntil : false
  }

  /** Evict a keep-alive entry: destroy engine, remove from registry. */
  evict(agentId: string, entry: KeepAliveEntry): void {
    if (entry.cleanupTimer) {
      clearTimeout(entry.cleanupTimer)
      entry.cleanupTimer = undefined
    }
    entry.keepAlive = false
    entry.engine.interrupt()
    this.entries.delete(agentId)
  }

  /** Register a new entry (called when agent is created). */
  register(agentId: string, entry: KeepAliveEntry): void {
    this.entries.set(agentId, entry)
  }

  /** Remove an entry (called when agent is cleaned up). */
  unregister(agentId: string): void {
    this.entries.delete(agentId)
  }

  /** Get an entry by ID. */
  get(agentId: string): KeepAliveEntry | undefined {
    return this.entries.get(agentId)
  }

  /** Number of workers in keep-alive state. */
  get keepAliveCount(): number {
    return Array.from(this.entries.values()).filter(e => e.keepAlive && !this.isExpired(e)).length
  }

  /** Clear all entries. */
  clear(): void {
    for (const [, entry] of this.entries) {
      if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer)
      entry.engine.interrupt()
    }
    this.entries.clear()
  }
}
