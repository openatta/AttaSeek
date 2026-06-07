/**
 * CompactPipeline — orchestrates the multi-stage compaction sequence.
 *
 * Pipeline (cheapest to most expensive):
 *   1. Snip — remove zombie messages and stale markers
 *   2. Time Micro — clear old tool results when session is idle
 *   3. Cache Micro — delete tool result blocks via API cache_edits (if supported)
 *   4. Session Memory — replace early messages with session summary
 *   5. Auto-Compact — LLM-based summarization (with circuit breaker)
 *
 * Each stage can degrade gracefully if not applicable.
 * The circuit breaker prevents infinite compaction loops.
 */

import type { LLMMessage } from '../llm/ModelProvider'
import type { AgentProfile } from '../profile/AgentProfile'
import { shouldCompact, compactConversation } from './ContextCompactor'

export interface CompactResult {
  compactedMessages: LLMMessage[]
  summary: string
  tokenSaved: number
  compactedCount: number
  stage: string  // which stage performed the compaction
}

// ── Circuit breaker ──

export class CircuitBreaker {
  private consecutiveFailures = 0
  readonly maxFailures: number

  constructor(maxFailures = 3) {
    this.maxFailures = maxFailures
  }

  get isOpen(): boolean {
    return this.consecutiveFailures >= this.maxFailures
  }

  recordSuccess(): void { this.consecutiveFailures = 0 }
  recordFailure(): void { this.consecutiveFailures++ }
  reset(): void { this.consecutiveFailures = 0 }
}

// ── Pipeline ──

export async function runCompactPipeline(
  messages: LLMMessage[],
  profile: AgentProfile,
  currentSummary: string,
  breaker: CircuitBreaker,
): Promise<CompactResult | null> {
  if (breaker.isOpen) return null

  // Stage 1: Snip — remove zombie messages
  const snipped = snipMessages(messages)
  if (snipped.length < messages.length) {
    return {
      compactedMessages: snipped,
      summary: currentSummary,
      tokenSaved: messages.length - snipped.length,
      compactedCount: messages.length - snipped.length,
      stage: 'snip',
    }
  }

  // Stage 2: Time micro — clear old tool results
  const timeMicroed = timeMicroCompact(messages, profile)
  if (timeMicroed) return timeMicroed

  // Stage 3-4: Check if auto-compact is needed
  if (shouldCompact(messages, profile)) {
    // Stage 4: Session memory compact (lighter, try first)
    // For now, go straight to LLM compact
    try {
      const compacted = await compactConversation(messages, profile, currentSummary)
      breaker.recordSuccess()
      return {
        ...compacted,
        stage: 'auto-compact',
      }
    } catch (err) {
      breaker.recordFailure()
      console.warn('[CompactPipeline] auto-compact failed:', err)
      return null
    }
  }

  return null
}

// ── Stage implementations ──

function snipMessages(messages: LLMMessage[]): LLMMessage[] {
  // Remove zombie tool_result messages that have no preceding tool_use
  const cleaned: LLMMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'user') {
      const content = Array.isArray(msg.content) ? msg.content : []
      const hasOrphan = content.some((b) => {
        const block = b as unknown as Record<string, unknown>
        return block.type === 'tool_result' && !block.tool_use_id
      })
      if (hasOrphan) continue
    }
    cleaned.push(msg)
  }
  return cleaned
}

function timeMicroCompact(
  messages: LLMMessage[],
  _profile: AgentProfile,
): CompactResult | null {
  // Placeholder: implement gap-detection for idle sessions
  // For now, return null (no-op)
  return null
}
