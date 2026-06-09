/**
 * Microcompactor — per-turn and time-based tool result trimming.
 *
 * Two sub-stages:
 *   1. **Content microcompact** — truncate individual tool results that
 *      exceed the character limit. This is cheap and runs every turn.
 *   2. **Time microcompact** — remove old tool_use/tool_result pairs
 *      that are far back in the conversation and no longer relevant.
 *
 * Mirrors Claude Code's microcompact (part of src/services/compact/).
 */

import type { LLMMessage, LLMContentBlock } from '../llm/ModelProvider'
import { MICROCOMPACT_MAX_TOOL_RESULT_CHARS } from '../../../shared/constants'

// ── Types ──

export interface MicrocompactResult {
  /** Messages after micro-compaction. */
  messages: LLMMessage[]
  /** Number of tool results trimmed or removed. Non-zero triggers hysteresis tracking. */
  compactedCount: number
  /** Pending cache edits — server-side cache mutations deferred until after API response. */
  pendingCacheEdits?: CacheEdit[]
  /** Approximate tokens freed. */
  tokensFreed: number
}

export interface CacheEdit {
  /** The tool_use_id whose result content is being replaced. */
  toolUseId: string
  /** The new (truncated) content to cache. */
  newContent: string
}

// ── Content microcompact (per-turn) ──

/**
 * Truncate tool result content that exceeds the character limit.
 * This is the existing `microcompact()` behavior, extracted and enhanced.
 *
 * @param toolResults — array of { content: string } blocks (from tool_result blocks)
 * @param maxChars — maximum characters per tool result (default: MICROCOMPACT_MAX_TOOL_RESULT_CHARS)
 */
export function microcompactResults(
  toolResults: { content: string }[],
  maxChars: number = MICROCOMPACT_MAX_TOOL_RESULT_CHARS,
): { content: string }[] {
  return toolResults.map(tr => {
    if (tr.content.length <= maxChars) return tr
    return {
      ...tr,
      content: tr.content.slice(0, maxChars) +
        `\n...[truncated ${tr.content.length - maxChars} chars]`,
    }
  })
}

/**
 * Apply content microcompact to all tool results in a message array.
 * Scans each user message for tool_result blocks and truncates them.
 */
export function microcompactMessages(
  messages: LLMMessage[],
  maxChars: number = MICROCOMPACT_MAX_TOOL_RESULT_CHARS,
): MicrocompactResult {
  let compactedCount = 0
  let tokensFreed = 0
  const pendingCacheEdits: CacheEdit[] = []

  const result = messages.map(msg => {
    if (msg.role !== 'user') return msg
    if (typeof msg.content === 'string') return msg
    if (!Array.isArray(msg.content)) return msg

    const blocks = msg.content as LLMContentBlock[]
    const compacted: LLMContentBlock[] = []
    for (const block of blocks) {
      if (block.type === 'tool_result' && block.content.length > maxChars) {
        const oldLen = block.content.length
        const newContent = block.content.slice(0, maxChars) +
          `\n...[truncated ${oldLen - maxChars} chars]`
        compacted.push({ ...block, content: newContent })
        compactedCount++
        tokensFreed += Math.ceil((oldLen - maxChars) / 4)

        // Track cache edits for provider-side cache invalidation
        if (block.tool_use_id) {
          pendingCacheEdits.push({
            toolUseId: block.tool_use_id,
            newContent,
          })
        }
      } else {
        compacted.push(block)
      }
    }

    return { ...msg, content: compacted }
  })

  return {
    messages: result,
    compactedCount,
    tokensFreed,
    pendingCacheEdits: pendingCacheEdits.length > 0 ? pendingCacheEdits : undefined,
  }
}

// ── Time microcompact (idle session) ──

/**
 * Remove old tool_use/tool_result pairs that are far back in the
 * conversation. A pair is "old" if it's more than `maxTurns` turns
 * from the end of the conversation.
 *
 * This is a softer version of snip — it only removes tool interaction
 * pairs while keeping the assistant's text responses (which contain
 * the reasoning and conclusions).
 */
export function timeMicrocompact(
  messages: LLMMessage[],
  maxTurnsBack: number = 10,
): MicrocompactResult {
  // Count turns from the end
  let userMessageCount = 0
  const keepFrom = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessageCount++
        if (userMessageCount >= maxTurnsBack) return i
      }
    }
    return 0 // keep all
  })()

  if (keepFrom <= 0) {
    return { messages, compactedCount: 0, tokensFreed: 0 }
  }

  // Remove tool_use/tool_result pairs from early messages
  const beforeTokens = estimateMessagesTokens(messages)
  const result: LLMMessage[] = []
  const toolUseIdsToRemove = new Set<string>()
  let compactedCount = 0

  // First pass: find tools to remove from early messages
  for (let i = 0; i < keepFrom; i++) {
    const msg = messages[i]
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content as LLMContentBlock[]) {
        if (block.type === 'tool_use' && block.id) {
          toolUseIdsToRemove.add(block.id)
        }
      }
    }
  }

  // Second pass: filter messages
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (i < keepFrom) {
      // Filter tool-related blocks from early messages
      if (Array.isArray(msg.content)) {
        const filtered = (msg.content as LLMContentBlock[]).filter(block => {
          if (block.type === 'tool_use' && block.id && toolUseIdsToRemove.has(block.id)) {
            compactedCount++
            return false
          }
          if (block.type === 'tool_result' && block.tool_use_id && toolUseIdsToRemove.has(block.tool_use_id)) {
            compactedCount++
            return false
          }
          return true
        })
        // Keep message only if it still has content
        if (filtered.length > 0 || msg.role !== 'user') {
          result.push({ ...msg, content: filtered })
        }
        // Drop empty user messages (all content was tool_results that were removed)
      } else {
        result.push(msg)
      }
    } else {
      result.push(msg)
    }
  }

  const afterTokens = estimateMessagesTokens(result)

  return {
    messages: result,
    compactedCount,
    tokensFreed: Math.max(0, beforeTokens - afterTokens),
  }
}

// ── Time-gap detection ──

/**
 * Extract the timestamp of the last assistant message from the conversation.
 * Returns 0 if no assistant message is found (no timestamp available).
 *
 * Used to detect cache-expiry gaps: if the last assistant message was more
 * than TIME_MICROCOMPACT_GAP_MINUTES ago, the server-side prompt cache has
 * likely expired, and we should clear old tool results before the next API
 * call to reduce prefix rewrite cost.
 */
export function getLastAssistantTimestamp(messages: LLMMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'assistant') {
      // Use message timestamp if available, otherwise fall back to now
      return (msg as { timestamp?: number }).timestamp ?? Date.now()
    }
  }
  return 0
}

/**
 * Check if time-based microcompact should run, based on the gap since
 * the last assistant message.
 *
 * @param messages — current conversation messages
 * @param state — time microcompact state (tracks last assistant timestamp)
 * @param gapMinutes — threshold in minutes (default: TIME_MICROCOMPACT_GAP_MINUTES)
 */
export function shouldTimeMicrocompact(
  messages: LLMMessage[],
  state: { lastAssistantTimestamp: number },
  gapMinutes: number = 60,
): boolean {
  if (messages.length < 10) return false

  const lastAssistantTs = getLastAssistantTimestamp(messages)
  if (lastAssistantTs === 0) return false

  // First run: record timestamp but don't compact yet
  if (state.lastAssistantTimestamp === 0) return false

  const gapMs = lastAssistantTs - state.lastAssistantTimestamp
  const gapMin = gapMs / 60_000

  return gapMin >= gapMinutes
}

/**
 * Combined microcompact: content + time-based.
 *
 * Runs content microcompact always, and time-based microcompact only if
 * the gap since the last assistant message exceeds the threshold.
 *
 * Updates `state` in place for timestamp tracking.
 *
 * @returns combined result with messages and stats
 */
export function microcompactWithTime(
  messages: LLMMessage[],
  state: { lastAssistantTimestamp: number; lastTimeMicrocompactAt: number; totalClearedByTimeMC: number },
  gapMinutes: number = 60,
): MicrocompactResult & { didTimeCompact: boolean } {
  // Always run content microcompact
  const contentResult = microcompactMessages(messages)

  // Check if time microcompact should run
  let didTimeCompact = false
  let finalMessages = contentResult.messages
  let totalCompactedCount = contentResult.compactedCount
  let totalTokensFreed = contentResult.tokensFreed
  const pendingCacheEdits = contentResult.pendingCacheEdits

  if (shouldTimeMicrocompact(messages, state, gapMinutes)) {
    const timeResult = timeMicrocompact(finalMessages)
    if (timeResult.compactedCount > 0) {
      finalMessages = timeResult.messages
      totalCompactedCount += timeResult.compactedCount
      totalTokensFreed += timeResult.tokensFreed
      didTimeCompact = true
      state.totalClearedByTimeMC += timeResult.compactedCount
    }
    state.lastTimeMicrocompactAt = Date.now()
  }

  // Update the last assistant timestamp
  const lastTs = getLastAssistantTimestamp(messages)
  if (lastTs > 0) {
    state.lastAssistantTimestamp = lastTs
  }

  return {
    messages: finalMessages,
    compactedCount: totalCompactedCount,
    tokensFreed: totalTokensFreed,
    pendingCacheEdits: pendingCacheEdits as MicrocompactResult['pendingCacheEdits'],
    didTimeCompact,
  }
}

// ── Helpers ──

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function estimateMessagesTokens(messages: LLMMessage[]): number {
  let total = 0
  for (const m of messages) {
    total += estimateTokens(
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    )
  }
  return total
}
