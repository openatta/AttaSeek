/**
 * ReactiveCompactor — API error-triggered aggressive context compaction.
 *
 * When the LLM API returns a context-length error (413 / prompt_too_long)
 * or a media-size error (image too large), this compactor applies more
 * aggressive strategies than proactive auto-compaction:
 *
 *   1. Truncate all tool results aggressively
 *   2. If still too long, compact to only the most recent ~1.5 turns
 *   3. If still too long, collapse to the last 2 messages
 *
 * Extracted from ContextCompactor.reactiveCompact() with enhancements:
 *   - Media-size error detection (image too large, etc.)
 *   - Configurable fallback chain (truncate → compact → collapse)
 *
 * Mirrors Claude Code's reactive compact (src/services/compact/reactiveCompact.ts).
 */

import { estimateMessagesTokens } from './token-counter'
import { autoCompact } from './AutoCompactor'
import { microcompactMessages } from './Microcompactor'
import type { LLMMessage } from '../llm/ModelProvider'
import type { AgentProfile } from '../profile/AgentProfile'
import { REACTIVE_COMPACT_MIN_CHARS } from '../../../shared/constants'

// ── Types ──

export interface ReactiveCompactResult {
  /** Messages after reactive compaction. */
  messages: LLMMessage[]
  /** Summary (if LLM compaction was used). */
  summary: string
  /** Estimated tokens freed. */
  tokensFreed: number
  /** Number of messages compacted/removed. */
  compressedCount: number
  /** Which strategy was applied. */
  strategy: ReactiveStrategy
}

export type ReactiveStrategy =
  | 'none'               // No compaction was needed/applied
  | 'truncate_results'   // Only truncated long tool results
  | 'compact_turns'      // LLM compaction to ~1.5 turns
  | 'collapse_minimal'    // Collapse to last 2 messages only
  | 'snip_aggressive'     // Aggressive snip (head+tail only)

// ── Error detection ──

/**
 * Check if an error is a context-length error (should trigger reactive compaction).
 * Expanded to cover more error signatures than the original.
 */
export function isContextLengthError(err: unknown): boolean {
  if (!err) return false
  const msg = typeof err === 'string' ? err
    : (err as { message?: string }).message || ''

  return (
    msg.includes('prompt_too_long') ||
    msg.includes('413') ||
    msg.includes('context_length_exceeded') ||
    msg.includes('prompt is too long') ||
    msg.includes('max_tokens') && msg.includes('exceed')
  )
}

/**
 * Check if an error is a media-size error (image/attachment too large).
 * These require truncating attachments, not just text compaction.
 */
export function isMediaSizeError(err: unknown): boolean {
  if (!err) return false
  const msg = typeof err === 'string' ? err
    : (err as { message?: string }).message || ''

  return (
    msg.includes('image_too_large') ||
    msg.includes('media_size') ||
    msg.includes('attachment_too_large') ||
    msg.includes('file size exceeds') ||
    msg.includes('image exceeds')
  )
}

// ── Core ──

/**
 * Reactive compact — triggered by API errors.
 *
 * Applies progressively more aggressive strategies:
 *   1. Truncate all tool results to REACTIVE_COMPACT_MIN_CHARS
 *   2. If still needed, LLM-compact to ~1.5 turns
 *   3. If still needed, collapse to last 2 messages
 *
 * @param messages — current conversation
 * @param profile — agent profile
 * @param existingSummary — previous compaction summary
 * @param error — the API error that triggered reactive compaction
 */
export async function reactiveCompact(
  messages: LLMMessage[],
  profile: AgentProfile,
  existingSummary?: string,
  error?: unknown,
): Promise<ReactiveCompactResult> {
  const beforeTokens = estimateMessagesTokens(messages)

  // Strategy 0: Check if error is media-size (we can't fix that by compacting text)
  if (error && isMediaSizeError(error)) {
    return {
      messages,
      summary: existingSummary || '',
      tokensFreed: 0,
      compressedCount: 0,
      strategy: 'none',
    }
  }

  // Strategy 1: Aggressive tool result truncation
  const microResult = microcompactMessages(messages, REACTIVE_COMPACT_MIN_CHARS)
  if (microResult.compactedCount > 0) {
    // Check if this was enough (heuristic: if we freed >20% of tokens)
    const afterMicroTokens = estimateMessagesTokens(microResult.messages)
    const microSaved = beforeTokens - afterMicroTokens
    if (microSaved > beforeTokens * 0.2) {
      return {
        messages: microResult.messages,
        summary: existingSummary || '',
        tokensFreed: microSaved,
        compressedCount: microResult.compactedCount,
        strategy: 'truncate_results',
      }
    }
  }

  // Strategy 2: LLM compaction to ~1.5 turns
  const keepCount = Math.max(2, Math.floor(profile.context.keepRecentTurns * 1.5))
  if (messages.length > keepCount) {
    // Already applied microResult — use those messages if they helped
    const messagesToCompact = microResult.compactedCount > 0 ? microResult.messages : messages

    try {
      const compacted = await autoCompact(
        messagesToCompact,
        { ...profile, context: { ...profile.context, keepRecentTurns: Math.ceil(keepCount / 2) } },
        existingSummary,
      )
      if (compacted.didCompact) {
        return {
          messages: compacted.messages,
          summary: compacted.summary,
          tokensFreed: beforeTokens - estimateMessagesTokens(compacted.messages),
          compressedCount: compacted.compressedCount,
          strategy: 'compact_turns',
        }
      }
    } catch (e) {
      console.warn('[ReactiveCompactor] LLM compaction failed:', e instanceof Error ? e.message : String(e))
    }
  }

  // Strategy 3: Collapse — keep only the last 2 messages
  if (messages.length > 2) {
    const tail = messages.slice(-2)
    const afterTokens = estimateMessagesTokens(tail)
    return {
      messages: tail,
      summary: existingSummary || `[Emergency collapse: kept last 2 of ${messages.length} messages]`,
      tokensFreed: Math.max(0, beforeTokens - afterTokens),
      compressedCount: messages.length - 2,
      strategy: 'collapse_minimal',
    }
  }

  // Strategy 4: Already minimal — truncate in place
  const truncated: LLMMessage[] = messages.map(m => {
    if (typeof m.content === 'string') return m
    return {
      ...m,
      content: (m.content as unknown as Array<Record<string, unknown>>).map((b: Record<string, unknown>) => {
        if (b.type === 'tool_result' && typeof b.content === 'string' && b.content.length > REACTIVE_COMPACT_MIN_CHARS) {
          return { ...b, content: (b.content as string).slice(0, REACTIVE_COMPACT_MIN_CHARS) + '\n...[truncated]' }
        }
        return b
      }),
    } as unknown as LLMMessage
  })

  return {
    messages: truncated,
    summary: existingSummary || '',
    tokensFreed: Math.max(0, beforeTokens - estimateMessagesTokens(truncated)),
    compressedCount: 0,
    strategy: 'truncate_results',
  }
}

// ── Withhold helpers (for query-loop streaming error recovery) ──

/**
 * Check if an LLM message is a prompt-too-long error that should be
 * withheld from the user while the recovery path tries to fix it.
 *
 * Mirrors Claude Code's isWithheldPromptTooLong pattern: the error is
 * held back during streaming, then the post-stream recovery block
 * attempts collapse-drain → reactive-compact before surfacing it.
 */
export function isWithheldPromptTooLong(msg: { type?: string; isApiErrorMessage?: boolean; message?: { content?: unknown } } | undefined): boolean {
  if (!msg) return false
  // Check for the synthetic assistant API error message type
  if ((msg as any).type === 'assistant' && (msg as any).isApiErrorMessage) {
    const content = (msg as any).message?.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'text' && typeof block.text === 'string') {
          if (isContextLengthErrorMessage(block.text)) return true
        }
      }
    }
  }
  return false
}

/**
 * Check if an LLM message is a media-size error that should be
 * withheld during streaming so reactive compact can strip images/PDFs.
 *
 * Mirrors Claude Code's reactiveCompact.isWithheldMediaSizeError.
 */
export function isWithheldMediaSizeError(msg: { type?: string; isApiErrorMessage?: boolean; message?: { content?: unknown } } | undefined): boolean {
  if (!msg) return false
  if ((msg as any).type === 'assistant' && (msg as any).isApiErrorMessage) {
    const content = (msg as any).message?.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'text' && typeof block.text === 'string') {
          if (isMediaSizeErrorMessage(block.text)) return true
        }
      }
    }
  }
  return false
}

// ── Error message string matchers ──

function isContextLengthErrorMessage(text: string): boolean {
  return (
    text.includes('prompt_too_long') ||
    text.includes('context_length_exceeded') ||
    text.includes('prompt is too long') ||
    text.includes('maximum context length')
  )
}

function isMediaSizeErrorMessage(text: string): boolean {
  return (
    text.includes('image_too_large') ||
    text.includes('media_size') ||
    text.includes('attachment_too_large') ||
    text.includes('file size exceeds') ||
    text.includes('image exceeds') ||
    text.includes('maximum file size')
  )
}

// ── tryReactiveCompact — convenience wrapper for query-loop recovery ──

export interface TryReactiveCompactParams {
  /** Whether reactive compact has already been attempted this turn. */
  hasAttempted: boolean
  /** Current messages to compact. */
  messages: LLMMessage[]
  /** Agent profile (for compaction parameters). */
  profile: AgentProfile
  /** Existing compaction summary (if any). */
  existingSummary?: string
  /** The error that triggered recovery (for strategy selection). */
  error?: unknown
}

export interface TryReactiveCompactResult {
  /** Messages after reactive compaction. */
  messages: LLMMessage[]
  /** Summary (LLM-generated). */
  summary: string
  /** Estimated tokens freed. */
  tokensFreed: number
  /** Number of messages compacted/removed. */
  compressedCount: number
}

/**
 * Try reactive compaction with guards:
 *   1. If already attempted this turn → null (prevents infinite loop)
 *   2. If error isn't context-length or media-size → null (wrong trigger)
 *   3. Run reactiveCompact → return result or null
 *
 * Returns null when no action was taken. The caller should surface the
 * original error when null is returned.
 */
export async function tryReactiveCompact(
  params: TryReactiveCompactParams,
): Promise<TryReactiveCompactResult | null> {
  if (params.hasAttempted) return null

  const result = await reactiveCompact(
    params.messages,
    params.profile,
    params.existingSummary,
    params.error,
  )

  if (result.strategy === 'none') return null

  return {
    messages: result.messages,
    summary: result.summary,
    tokensFreed: result.tokensFreed,
    compressedCount: result.compressedCount,
  }
}
