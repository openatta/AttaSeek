/**
 * CacheSafeParams — prompt cache sharing contract between parent and forked agents.
 *
 * When a parent agent forks a sub-agent (or runs compact/extract),
 * the static portions of the system prompt and tool definitions
 * can be reused from Anthropic's prompt cache.
 *
 * Cache scope: within a single task's agent tree (parent + children).
 * Not persisted across tasks or sessions.
 */
import type { LLMToolDef } from '../llm/ModelProvider'

export interface CacheSafeParams {
  /** Static (pre-boundary) portion of the system prompt */
  systemPromptStatic: string
  /** Tool definitions — must be identical between parent and child */
  tools: LLMToolDef[]
  /** Model identifier for cache namespace */
  modelId: string
  /** Profile identifier for cache namespace */
  profileId: string
}

export interface CacheEntry {
  key: string
  params: CacheSafeParams
  createdAt: number
  hitCount: number
}

/** Generate a deterministic cache key from params */
export function cacheKey(params: CacheSafeParams): string {
  const payload = `${params.profileId}:${params.modelId}:${params.systemPromptStatic.length}:${params.tools.length}`
  // Simple hash for stable keying
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash |= 0
  }
  return `cache_${Math.abs(hash).toString(36)}`
}

const MAX_CACHE_ENTRIES = 50
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

export class CacheManager {
  private cache = new Map<string, CacheEntry>()

  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    for (const [k, v] of this.cache) {
      if (v.createdAt < oldestTime) { oldestTime = v.createdAt; oldestKey = k }
    }
    if (oldestKey) this.cache.delete(oldestKey)
  }

  createCache(params: CacheSafeParams): string {
    if (this.cache.size >= MAX_CACHE_ENTRIES) this.evictOldest()
    const key = cacheKey(params)
    this.cache.set(key, {
      key,
      params,
      createdAt: Date.now(),
      hitCount: 0,
    })
    return key
  }

  getCache(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.createdAt > CACHE_TTL_MS) { this.cache.delete(key); return undefined }
    entry.hitCount++
    return entry
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /** Clean all caches — called on BrowserWindow close */
  cleanup(): void {
    this.cache.clear()
  }

  get size(): number { return this.cache.size }
}

export const cacheManager = new CacheManager()
