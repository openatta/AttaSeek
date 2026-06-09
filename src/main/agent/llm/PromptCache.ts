/**
 * PromptCache — Anthropic prompt cache breakpoint management.
 *
 * Manages `cache_control: { type: 'ephemeral' }` markers on system prompt,
 * tool definitions, and messages for Anthropic's prompt caching feature.
 *
 * Strategy (mirrors Claude Code's cache system):
 *   - System prompt static prefix (identity + rules) → cache_control at end
 *   - Dynamic suffix (session info, git context) → NOT cached
 *   - Tool definitions → cache_control on the last tool
 *   - Per-message caching: last content block of user + assistant messages → cache_control
 *   - TTL: 1h TTL for eligible models (Pro/Max tier, non-Haiku)
 *   - Sub-agent forks share the same cache key if their profile + tools match
 *   - Cache break detection: logs diagnostics when cache unexpectedly breaks
 *
 * Cache key: SHA256(profileId + sorted tool names + modelId)
 *
 * Phase E: Anthropic-only. OpenAI-compatible providers ignore cache markers.
 */

import crypto from 'crypto'
import { cacheBreakDetector } from './cache-break-detector'

// ── Types ──

export interface CacheBreakpoint {
  type: 'ephemeral'
  /** Optional TTL for extended cache lifetime (1h for eligible models). */
  ttl?: '1h'
  /** Optional global scope for cross-session cache sharing. */
  scope?: 'global'
}

export interface PromptCacheConfig {
  /** Whether prompt caching is enabled. */
  enabled: boolean
  /** Profile identifier (part of cache key). */
  profileId: string
  /** Sorted tool names (part of cache key). */
  toolNames: string[]
  /** Model identifier (part of cache key, also used for TTL eligibility). */
  modelId: string
  /** Whether to use 1h TTL (for Pro/Max tier users). */
  useExtendedTTL?: boolean
}

export interface CacheInfo {
  /** Cache key (SHA-256 hex). */
  key: string
  /** System prompt up to the breakpoint (cacheable prefix). */
  systemPrefix: string
  /** System prompt after the breakpoint (dynamic suffix). */
  systemSuffix: string
  /** Tools with cache marker on last tool. */
  toolsWithCacheMarkers: Array<Record<string, unknown>>
  /** Whether per-message caching is enabled for this config. */
  perMessageCaching: boolean
  /** Cache control marker to apply to the last content block of each message pair. */
  messageCacheControl?: { type: 'ephemeral'; ttl?: '1h' }
}

// ── Cache control marker builders ──

/** Build a cache_control marker for the given TTL/scope settings. */
export function buildCacheControl(config: PromptCacheConfig): { type: 'ephemeral'; ttl?: '1h' } {
  const cc: { type: 'ephemeral'; ttl?: '1h' } = { type: 'ephemeral' }
  if (config.useExtendedTTL && !isHaikuModel(config.modelId)) {
    cc.ttl = '1h'
  }
  return cc
}

/** Check if a model is a Haiku variant (which has different cache behavior). */
function isHaikuModel(modelId: string): boolean {
  return modelId.toLowerCase().includes('haiku')
}

/** Check if per-message caching is beneficial for this model. */
export function shouldUsePerMessageCaching(modelId: string): boolean {
  // Per-message caching adds overhead — only enable for larger models
  return !isHaikuModel(modelId)
}

// ── Dynamic boundary marker ──

/**
 * Marker that separates the cacheable static prefix from the dynamic
 * suffix in the system prompt. Everything before this marker is
 * eligible for caching; everything after is not.
 */
const DYNAMIC_BOUNDARY = '\n## Session Info\n'

// ── Core ──

/**
 * Build a cache key from the components that determine cache eligibility.
 * Same profile + tools + model → same key → cache hit.
 */
export function buildCacheKey(
  profileId: string,
  toolNames: string[],
  modelId: string,
): string {
  const components = `${profileId}|${[...toolNames].sort().join(',')}|${modelId}`
  return crypto.createHash('sha256').update(components).digest('hex').slice(0, 16)
}

/**
 * Split a system prompt at the dynamic boundary and return cacheable
 * prefix + dynamic suffix.
 *
 * The prefix (everything before the boundary) gets a cache_control
 * breakpoint. The suffix (everything after) is not cached.
 */
export function splitSystemPrompt(
  systemPrompt: string,
): { prefix: string; suffix: string } {
  const idx = systemPrompt.indexOf(DYNAMIC_BOUNDARY)
  if (idx === -1) {
    // No dynamic section found — cache the whole prompt
    return { prefix: systemPrompt, suffix: '' }
  }
  return {
    prefix: systemPrompt.slice(0, idx),
    suffix: systemPrompt.slice(idx),
  }
}

/**
 * Prepare system prompt for Anthropic prompt caching.
 *
 * If caching is enabled:
 *   - Split prompt at dynamic boundary
 *   - Add cache_control breakpoint to prefix
 *   - Return prefix (cached) + suffix (uncached)
 *   - Enable per-message caching for non-Haiku models
 *
 * If caching is disabled, return the prompt unmodified.
 */
export function preparePromptCache(
  systemPrompt: string,
  config: PromptCacheConfig,
): CacheInfo {
  const toolNames = [...config.toolNames].sort()
  const key = buildCacheKey(config.profileId, toolNames, config.modelId)
  const perMessageCaching = shouldUsePerMessageCaching(config.modelId)
  const messageCacheControl = perMessageCaching ? buildCacheControl(config) : undefined

  if (!config.enabled) {
    return {
      key,
      systemPrefix: systemPrompt,
      systemSuffix: '',
      toolsWithCacheMarkers: [],
      perMessageCaching: false,
    }
  }

  const { prefix, suffix } = splitSystemPrompt(systemPrompt)
  const cacheControl = buildCacheControl(config)

  // Add cache_control to the last tool definition
  const toolsWithMarkers = config.toolNames.map((_name, i, arr) => ({
    cache_control: i === arr.length - 1 ? cacheControl : undefined,
  }))

  // Log cache state for break detection
  cacheBreakDetector.capture({
    systemPrompt,
    tools: config.toolNames.map(n => ({ name: n, description: '', input_schema: {} })),
    modelId: config.modelId,
    messageCharCount: 0, // Will be updated per-call
    isFastMode: false,
    querySource: 'prompt_cache',
  })

  return {
    key,
    systemPrefix: prefix,
    systemSuffix: suffix,
    toolsWithCacheMarkers: toolsWithMarkers.filter(t => t.cache_control),
    perMessageCaching: true,
    messageCacheControl,
  }
}

/**
 * Apply per-message cache control markers to a list of messages.
 *
 * The last content block of each user and assistant message gets a
 * cache_control marker, forming cache breakpoints at message boundaries.
 * Thinking/redacted_thinking blocks are excluded.
 *
 * Returns new messages with cache_control markers applied.
 * Does NOT modify the original messages.
 */
export function applyPerMessageCacheControl(
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
  cacheControl: { type: 'ephemeral'; ttl?: '1h' },
): Array<{ role: string; content: string | Array<Record<string, unknown>> }> {
  return messages.map((msg, msgIdx) => {
    if (typeof msg.content === 'string') {
      // Simple text message — add cache_control to the content if it's the last message
      if (msgIdx === messages.length - 1) {
        return {
          ...msg,
          content: [{ type: 'text', text: msg.content, cache_control: cacheControl }],
        }
      }
      return msg
    }

    // Complex content array — add cache_control to the last non-thinking block
    const blocks = msg.content as Array<Record<string, unknown>>
    const lastCacheableIdx = findLastCacheableIndex(blocks)

    if (lastCacheableIdx === -1) return msg

    const newBlocks = blocks.map((block, i) => {
      if (i === lastCacheableIdx) {
        return { ...block, cache_control: cacheControl }
      }
      return block
    })

    return { ...msg, content: newBlocks }
  })
}

/** Find the last content block index that can receive a cache_control marker. */
function findLastCacheableIndex(blocks: Array<Record<string, unknown>>): number {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]
    const blockType = block.type as string
    // Skip thinking blocks — they can't be cached
    if (blockType === 'thinking' || blockType === 'redacted_thinking') continue
    // Skip blocks that already have cache_control
    if (block.cache_control) continue
    return i
  }
  return -1
}

// ── Cache key registry (cross-subagent sharing) ──

const _cacheRegistry = new Map<string, string>()

/**
 * Register a cache key for a profile+tools+model combo.
 * Sub-agents with the same profile can look up the key and reuse the cache.
 */
export function registerCacheKey(config: PromptCacheConfig): string {
  const key = buildCacheKey(config.profileId, config.toolNames, config.modelId)
  const lookupKey = `${config.profileId}|${config.modelId}`
  _cacheRegistry.set(lookupKey, key)
  return key
}

/**
 * Look up a previously registered cache key.
 * Returns undefined if no matching key exists (sub-agent with different setup).
 */
export function lookupCacheKey(profileId: string, modelId: string): string | undefined {
  return _cacheRegistry.get(`${profileId}|${modelId}`)
}

/** Clear the cache key registry (e.g., on session reset). */
export function clearCacheRegistry(): void {
  _cacheRegistry.clear()
}
