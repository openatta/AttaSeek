/**
 * recovery-router — unified error recovery routing for the query loop.
 *
 * Consolidates the recovery logic from query-loop.ts into a single pure
 * function with per-level attempt limits and a circuit breaker.
 *
 * Mirrors Claude Code's multi-level recovery in src/query.ts, with the
 * addition of explicit per-level attempt caps and consecutive-failure
 * circuit breaking to prevent infinite retry loops.
 */

import { agentEventBus } from '../AgentEventBus'
import { isContextLengthError, runReactiveCompaction } from '../compact/CompactionPipeline'
import type { LLMMessage } from '../llm/ModelProvider'
import type { AgentProfile } from '../profile/AgentProfile'
import type { RecoveryLevel, TerminalReason } from './transitions'
import {
  RECOVERY_L1_MAX_ATTEMPTS,
  RECOVERY_L2_MAX_ATTEMPTS,
  RECOVERY_L3_MAX_ATTEMPTS,
  RECOVERY_L2_WAIT_BASE_MS,
  RECOVERY_L2_WAIT_MAX_MS,
  RECOVERY_L4_KEEP_TURNS,
} from '../../../shared/constants'

// ── Recovery state ──

export interface RecoveryState {
  /** Total recovery attempts across all levels (for global limit) */
  globalAttempts: number
  /** L1 transparent retry count */
  l1Attempts: number
  /** L2 wait-retry count */
  l2Attempts: number
  /** L3 reactive compact count */
  l3Attempts: number
  /** Consecutive failures of the same level (circuit breaker) */
  consecutiveSameLevel: number
  /** Which level triggered the last consecutive failure */
  lastFailedLevel: RecoveryLevel | undefined
}

export function createRecoveryState(): RecoveryState {
  return {
    globalAttempts: 0,
    l1Attempts: 0,
    l2Attempts: 0,
    l3Attempts: 0,
    consecutiveSameLevel: 0,
    lastFailedLevel: undefined,
  }
}

/** Max consecutive failures of the same recovery strategy before circuit-breaking to fail. */
const CIRCUIT_BREAKER_THRESHOLD = 3

// ── Recovery route result ──

export interface RecoveryRouteResult {
  /** The chosen recovery action, or 'fail' if all strategies exhausted. */
  level: RecoveryLevel
  /** Human-readable diagnostic label. */
  label: string
}

// ── Router ──

/**
 * Pure function: given an error and recovery state, return the next
 * recovery action. Mutates `state` in place for attempt counters.
 *
 * @param err        - The error thrown by the LLM call.
 * @param state      - Mutable recovery state (attempt counters).
 * @param signal     - AbortSignal for cancellation check.
 * @param messages   - Current message list (may be mutated by L3/L4).
 * @param profile    - Agent profile (for compaction parameters).
 * @param compactSummary - Existing compaction summary (if any).
 * @param sessionId  - Session ID for event emission.
 * @param taskId     - Task ID for event emission.
 */
export async function routeError(
  err: unknown,
  state: RecoveryState,
  signal: AbortSignal,
  messages: LLMMessage[],
  profile: AgentProfile,
  compactSummary: string | undefined,
  sessionId: string,
  taskId: string,
): Promise<RecoveryRouteResult> {
  if (signal.aborted) return { level: 'fail', label: 'aborted' }

  state.globalAttempts++
  const code = (err as any)?.code as string | undefined

  // ── L1: Transparent retry for transient errors ──
  if (code === 'server' || code === 'timeout' || code === 'unknown') {
    if (state.l1Attempts >= RECOVERY_L1_MAX_ATTEMPTS) {
      return maybeCircuitBreak(state, 'retry', 'L1 retry limit reached')
    }
    state.l1Attempts++
    trackLevel(state, 'retry')
    return { level: 'retry', label: `L1 retry ${state.l1Attempts}/${RECOVERY_L1_MAX_ATTEMPTS}` }
  }

  // ── L2: Wait-then-retry for rate limits ──
  if (code === 'rate_limit') {
    if (state.l2Attempts >= RECOVERY_L2_MAX_ATTEMPTS) {
      return maybeCircuitBreak(state, 'wait_retry', 'L2 wait-retry limit reached')
    }
    state.l2Attempts++
    const delay = Math.min(
      RECOVERY_L2_WAIT_BASE_MS * Math.pow(2, state.l2Attempts - 1),
      RECOVERY_L2_WAIT_MAX_MS,
    )
    await new Promise(r => setTimeout(r, delay))
    trackLevel(state, 'wait_retry')
    return { level: 'wait_retry', label: `L2 wait-retry ${state.l2Attempts}/${RECOVERY_L2_MAX_ATTEMPTS} (${delay}ms)` }
  }

  // ── L3: Reactive compaction for context-length errors ──
  // Uses the new CompactionPipeline.runReactiveCompaction() which delegates to
  // ReactiveCompactor with its 4-strategy fallback chain (truncate → compact_turns
  // → collapse_minimal → snip_aggressive), replacing the deprecated
  // ContextCompactor.reactiveCompact().
  if (isContextLengthError(err)) {
    if (state.l3Attempts >= RECOVERY_L3_MAX_ATTEMPTS) {
      return maybeCircuitBreak(state, 'compact', 'L3 compact limit reached')
    }
    state.l3Attempts++
    try {
      const compacted = await runReactiveCompaction(messages, profile, err, compactSummary)
      if (compacted.strategy !== 'none') {
        // Mutate messages in place (caller expects this)
        messages.length = 0
        messages.push(...compacted.messages)
        // Emit compaction event with strategy info
        agentEventBus.emit({
          id: `compact_${Date.now()}`,
          sessionId,
          taskId,
          type: 'CompactBoundary',
          payload: {
            summary: compacted.summary,
            tokenSaved: compacted.tokensFreed,
            compactedMessageCount: compacted.compressedCount,
            strategy: compacted.strategy,
          },
          createdAt: Date.now(),
        } as any)
        trackLevel(state, 'compact')
        return { level: 'compact', label: `L3 reactive compact (${compacted.strategy}) ${state.l3Attempts}/${RECOVERY_L3_MAX_ATTEMPTS}` }
      }
      // Strategy was 'none' — fall through to L4
    } catch {
      // Compact failed — fall through to L4
    }
  }

  // ── L4: Context collapse — aggressive truncation ──
  if (isContextLengthError(err)) {
    const keepCount = RECOVERY_L4_KEEP_TURNS * 2
    const truncated = messages.slice(-keepCount)
    messages.length = 0
    messages.push(...truncated)
    trackLevel(state, 'collapse')
    return { level: 'collapse', label: `L4 collapse (kept last ${keepCount} messages)` }
  }

  // ── L5: Give up ──
  return { level: 'fail', label: 'L5 all strategies exhausted' }
}

// ── Helpers ──

function trackLevel(state: RecoveryState, level: RecoveryLevel): void {
  if (state.lastFailedLevel === level) {
    state.consecutiveSameLevel++
  } else {
    state.consecutiveSameLevel = 1
    state.lastFailedLevel = level
  }
}

function maybeCircuitBreak(
  state: RecoveryState,
  level: RecoveryLevel,
  _reason: string,
): RecoveryRouteResult {
  state.consecutiveSameLevel++
  if (state.consecutiveSameLevel >= CIRCUIT_BREAKER_THRESHOLD) {
    return { level: 'fail', label: `Circuit breaker: ${state.consecutiveSameLevel} consecutive ${level} failures` }
  }
  return { level: 'fail', label: `${level} attempts exhausted` }
}

// ── Public helpers for query loop integration ──

/** Check if an error is a media-size related error (images/PDFs too large). */
export function isMediaSizeError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase()
  return msg.includes('media') && (msg.includes('too_large') || msg.includes('size') || msg.includes('exceed'))
}

/**
 * Determine the max output token upgrade for max_output_tokens recovery.
 * Returns the escalated token count, or undefined if already at max.
 */
export function escalateMaxOutputTokens(currentOverride: number | undefined): number | undefined {
  const DEFAULT_ESCALATED_TOKENS = 64_000
  if (currentOverride === undefined) return DEFAULT_ESCALATED_TOKENS
  // Already escalated — don't go higher
  if (currentOverride >= DEFAULT_ESCALATED_TOKENS) return undefined
  return DEFAULT_ESCALATED_TOKENS
}

/** Max number of max_output_tokens recovery attempts before giving up. */
export const MAX_OUTPUT_RECOVERY_ATTEMPTS = 3
