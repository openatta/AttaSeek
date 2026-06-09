/**
 * FileStateCache — layered LRU + TTL cache for file read results.
 *
 * Mirrors Claude Code's FileStateCache pattern. Maintains a deduplicated
 * view of files the agent has read, with time-based invalidation and LRU
 * eviction. Used by the tool execution layer to avoid re-reading files
 * that haven't changed between tool calls.
 *
 * Two tiers:
 *   L1 — in-memory LRU (hot cache, sub-ms access)
 *   L2 — TTL-based freshness (ensures stale entries are dropped)
 *
 * Thread-safe: all mutations are synchronous; no locks needed in Node.js
 * single-threaded main process.
 */

import {
  FILE_CACHE_MAX_ENTRIES,
  FILE_CACHE_TTL_MS,
} from '../../../shared/constants'

// ── Types ──

export interface CachedFileEntry {
  /** Absolute file path (cache key). */
  path: string
  /** File content at read time. */
  content: string
  /** File size in bytes at read time. */
  size: number
  /** POSIX mtime (ms) at read time. */
  mtimeMs: number
  /** When this entry was cached (ms epoch). */
  cachedAt: number
  /** How many times this entry was accessed. */
  accessCount: number
}

export interface CacheStats {
  /** Total entries currently cached. */
  size: number
  /** Cumulative hits since creation. */
  hits: number
  /** Cumulative misses since creation. */
  misses: number
  /** Cumulative evictions (LRU + TTL). */
  evictions: number
}

// ── LRU Node (doubly-linked list) ──

interface LRUNode {
  path: string
  prev: LRUNode | null
  next: LRUNode | null
}

// ── Cache ──

export class FileStateCache {
  private entries = new Map<string, CachedFileEntry>()
  private stats: CacheStats = { size: 0, hits: 0, misses: 0, evictions: 0 }

  // LRU tracking
  private head: LRUNode | null = null
  private tail: LRUNode | null = null
  private nodeMap = new Map<string, LRUNode>()

  private readonly maxEntries: number
  private readonly ttlMs: number

  constructor(maxEntries: number = FILE_CACHE_MAX_ENTRIES, ttlMs: number = FILE_CACHE_TTL_MS) {
    this.maxEntries = maxEntries
    this.ttlMs = ttlMs
  }

  // ── Public API ──

  /**
   * Get a cached file entry. Returns undefined if not found or expired.
   * On hit, promotes the entry to MRU (most-recently-used).
   */
  get(path: string): CachedFileEntry | undefined {
    const entry = this.entries.get(path)

    // Not in cache
    if (!entry) {
      this.stats.misses++
      return undefined
    }

    // TTL expired — evict synchronously
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.evict(path)
      this.stats.misses++
      return undefined
    }

    // Hit — promote to MRU
    this.touch(path)
    entry.accessCount++
    this.stats.hits++
    return entry
  }

  /**
   * Set a file entry in the cache. If the cache is full, evicts the LRU entry.
   * If the path already exists, updates the entry and promotes it.
   */
  set(path: string, content: string, size: number, mtimeMs: number): void {
    // Remove existing entry if present (will be re-added as MRU)
    if (this.entries.has(path)) {
      this.evict(path)
    }

    // Evict LRU if at capacity
    while (this.entries.size >= this.maxEntries) {
      const lru = this.tail
      if (!lru) break
      this.evict(lru.path)
    }

    // Add new entry
    const entry: CachedFileEntry = {
      path,
      content,
      size,
      mtimeMs,
      cachedAt: Date.now(),
      accessCount: 0,
    }
    this.entries.set(path, entry)
    this.addToLRU(path)
    this.stats.size = this.entries.size
  }

  /**
   * Check if a file is in cache and still fresh (based on mtime comparison).
   * Used by tool execution to decide whether to re-read a file.
   */
  has(path: string, currentMtimeMs?: number): boolean {
    const entry = this.get(path)
    if (!entry) return false
    if (currentMtimeMs !== undefined && entry.mtimeMs !== currentMtimeMs) {
      // File modified since cached — evict stale
      this.evict(path)
      return false
    }
    return true
  }

  /**
   * Invalidate a specific path. Use when a file is known to have changed
   * (e.g., after an Edit or Write tool call).
   */
  invalidate(path: string): void {
    this.evict(path)
  }

  /**
   * Invalidate all entries under a directory prefix.
   */
  invalidatePrefix(dirPath: string): void {
    const prefix = dirPath.endsWith('/') ? dirPath : dirPath + '/'
    for (const path of this.entries.keys()) {
      if (path.startsWith(prefix)) {
        this.evict(path)
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.entries.clear()
    this.nodeMap.clear()
    this.head = null
    this.tail = null
    this.stats.size = 0
  }

  /** Get cache statistics (for telemetry/debugging). */
  getStats(): Readonly<CacheStats> {
    return { ...this.stats, size: this.entries.size }
  }

  /** Get all cached paths (for debugging). */
  getPaths(): string[] {
    return Array.from(this.entries.keys())
  }

  /** Size of the cache. */
  get size(): number {
    return this.entries.size
  }

  // ── Private: LRU list ──

  private addToLRU(path: string): void {
    const node: LRUNode = { path, prev: null, next: this.head }
    if (this.head) {
      this.head.prev = node
    }
    this.head = node
    if (!this.tail) {
      this.tail = node
    }
    this.nodeMap.set(path, node)
  }

  private touch(path: string): void {
    const node = this.nodeMap.get(path)
    if (!node) return

    // Already at head
    if (this.head === node) return

    // Unlink from current position
    if (node.prev) node.prev.next = node.next
    if (node.next) node.next.prev = node.prev
    if (this.tail === node) this.tail = node.prev

    // Move to head
    node.prev = null
    node.next = this.head
    if (this.head) this.head.prev = node
    this.head = node
  }

  private evict(path: string): void {
    this.entries.delete(path)

    const node = this.nodeMap.get(path)
    if (node) {
      if (node.prev) node.prev.next = node.next
      if (node.next) node.next.prev = node.prev
      if (this.head === node) this.head = node.next
      if (this.tail === node) this.tail = node.prev
      this.nodeMap.delete(path)
    }

    this.stats.evictions++
    this.stats.size = this.entries.size
  }
}

// ── Singleton (for main process) ──

let _instance: FileStateCache | null = null

/** Get the process-wide file state cache singleton. */
export function getFileStateCache(): FileStateCache {
  if (!_instance) {
    _instance = new FileStateCache()
  }
  return _instance
}

/** Reset the singleton (for testing). */
export function resetFileStateCache(): void {
  _instance = null
}
