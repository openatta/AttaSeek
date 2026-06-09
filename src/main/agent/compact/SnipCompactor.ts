/**
 * SnipCompactor — removes middle conversation turns, keeping head and tail.
 *
 * Mirrors Claude Code's snip compaction (src/services/compact/snipCompact.ts).
 * The idea: in long conversations, the middle is often intermediate debugging
 * and exploration. The head (first exchanges — user's goal, initial approach)
 * and tail (most recent context) are the most valuable.
 *
 * Unlike auto-compact (LLM summarization), snip is deterministic and cheap.
 * It preserves actual messages, just fewer of them.
 */

import type { LLMMessage } from '../llm/ModelProvider'

// ── Types ──

export interface SnipResult {
  /** Messages after snipping (head + tail). */
  messages: LLMMessage[]
  /** Estimated tokens freed by removing middle messages. */
  tokensFreed: number
  /** Number of messages removed. */
  removedCount: number
  /** Optional boundary message for the UI (tombstone placeholder). */
  boundaryMessage?: { role: 'user'; content: string }
  /** Whether any messages were actually removed. */
  didSnip: boolean
}

export interface SnipConfig {
  /** Number of messages to keep from the start (head). Default: 2. */
  keepHead: number
  /** Number of turn-pairs to keep from the end (tail). Default: 5. */
  keepTailTurns: number
  /** Minimum total messages before snip activates. Default: 20. */
  minMessages: number
}

// ── Defaults ──

const DEFAULT_CONFIG: SnipConfig = {
  keepHead: 2,
  keepTailTurns: 5,
  minMessages: 20,
}

// ── Character-based token estimation ──

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function estimateMessageTokens(msg: LLMMessage): number {
  if (typeof msg.content === 'string') return estimateTokens(msg.content)
  return estimateTokens(JSON.stringify(msg.content))
}

// ── Core ──

/**
 * Snip compact — keep head messages + tail turns, remove everything in between.
 *
 * Head: first `config.keepHead` messages (typically user's opening message
 *   + assistant's initial response — captures the task intent).
 * Tail: last `config.keepTailTurns * 2` messages (user+assistant pairs
 *   for the most recent turns — captures current state).
 *
 * Returns the same messages array if no snipping is needed (too few messages
 * or tail already overlaps head).
 */
export function snipCompact(
  messages: LLMMessage[],
  config: Partial<SnipConfig> = {},
): SnipResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const tailMessages = cfg.keepTailTurns * 2 // user + assistant per turn

  // Not enough messages to bother
  if (messages.length < cfg.minMessages) {
    return { messages, tokensFreed: 0, removedCount: 0, didSnip: false }
  }

  // Tail already covers head — nothing to snip
  if (messages.length <= cfg.keepHead + tailMessages) {
    return { messages, tokensFreed: 0, removedCount: 0, didSnip: false }
  }

  const head = messages.slice(0, cfg.keepHead)
  const tail = messages.slice(-tailMessages)
  const removed = messages.slice(cfg.keepHead, -tailMessages)

  // Estimate tokens freed
  const beforeTokens = messages.reduce((s, m) => s + estimateMessageTokens(m), 0)
  const afterMessages = [...head, ...tail]
  const afterTokens = afterMessages.reduce((s, m) => s + estimateMessageTokens(m), 0)
  const tokensFreed = Math.max(0, beforeTokens - afterTokens)

  // Build tombstone boundary message for UI continuity
  const boundaryMessage: { role: 'user'; content: string } = {
    role: 'user',
    content: `[Content snipped: ${removed.length} intermediate messages removed ` +
      `(~${tokensFreed} tokens). The head and tail of the conversation are preserved.]`,
  }

  // Insert boundary between head and tail
  const result: LLMMessage[] = [...head, boundaryMessage, ...tail]

  return {
    messages: result,
    tokensFreed,
    removedCount: removed.length,
    boundaryMessage,
    didSnip: true,
  }
}

/**
 * Lightweight snip for use near context limits.
 * More aggressive: keep only 1 head message and 3 tail turns.
 */
export function aggressiveSnip(messages: LLMMessage[]): SnipResult {
  return snipCompact(messages, { keepHead: 1, keepTailTurns: 3, minMessages: 10 })
}

/**
 * Find the natural snip boundary — the last user message before the tail
 * that starts a new topic. Falls back to the configured keepTailTurns.
 */
export function findSnipBoundary(
  messages: LLMMessage[],
  tailTurns: number = 5,
): number {
  // Start from the end and walk backward looking for user messages
  // that appear to start new topics (contain goal-setting language).
  const topicStarters = /\b(I want|I need|let's|now |next |could you|please |帮我|帮我做|我想要|接下来)\b/i
  let userCount = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    userCount++
    if (userCount > tailTurns) {
      // Check if this user message starts a new topic
      const content = typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((b: unknown) => (b as { text?: string }).text || '').join(' ')
      if (topicStarters.test(content.slice(0, 200))) {
        return i // Snip everything before this point
      }
    }
  }
  // Fall back to tailTurns from the end
  return Math.max(0, messages.length - tailTurns * 2)
}
