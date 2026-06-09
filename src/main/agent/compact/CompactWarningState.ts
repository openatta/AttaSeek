/**
 * CompactWarningState — compaction warning hysteresis tracking.
 *
 * Prevents repeated "context is getting large" warnings within a suppression
 * window. Mirrors Claude Code's compactWarningState.ts pattern.
 *
 * When the token budget approaches the compaction trigger ratio, a warning
 * is emitted. This warning is suppressed for a configurable duration to
 * avoid flooding the user with repeated alerts.
 */

import {
  COMPACT_WARNING_SUPPRESS_MS,
  COMPACT_WARNING_TRIGGER_RATIO,
} from '../../../shared/constants'

// ── Types ──

export interface CompactWarningState {
  /** Timestamp (ms) of the last warning emitted. 0 = never. */
  lastWarningAt: number
  /** Whether warning suppression is active. */
  suppressed: boolean
  /** Token count at the time of the last warning (for delta tracking). */
  tokenCountAtLastWarning: number
}

export interface CompactWarningConfig {
  /** Ratio of budget at which warnings start. Default: COMPACT_WARNING_TRIGGER_RATIO (0.75). */
  triggerRatio: number
  /** Suppression window in ms. Default: COMPACT_WARNING_SUPPRESS_MS (60_000). */
  suppressMs: number
}

// ── Defaults ──

const DEFAULT_CONFIG: CompactWarningConfig = {
  triggerRatio: COMPACT_WARNING_TRIGGER_RATIO,
  suppressMs: COMPACT_WARNING_SUPPRESS_MS,
}

// ── Factory ──

/** Create a fresh compact warning state. */
export function createCompactWarningState(): CompactWarningState {
  return {
    lastWarningAt: 0,
    suppressed: false,
    tokenCountAtLastWarning: 0,
  }
}

// ── Warning evaluation ──

/**
 * Check if a compaction warning should be emitted.
 *
 * Returns true if:
 *   1. Token usage exceeds the trigger ratio of the budget.
 *   2. Warnings are not suppressed.
 *   3. Sufficient new content has been added since the last warning.
 *
 * DOES NOT mutate state. Call `suppressWarning()` after emitting.
 */
export function shouldEmitCompactWarning(
  currentTokens: number,
  tokenBudget: number,
  state: CompactWarningState,
  config: Partial<CompactWarningConfig> = {},
): boolean {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Budget check: are we approaching the trigger ratio?
  const ratio = currentTokens / Math.max(1, tokenBudget)
  if (ratio < cfg.triggerRatio) return false

  // Suppression check: has enough time passed?
  if (state.suppressed) return false
  if (state.lastWarningAt > 0) {
    const elapsed = Date.now() - state.lastWarningAt
    if (elapsed < cfg.suppressMs) return false
  }

  // Delta check: enough new content since last warning?
  if (state.tokenCountAtLastWarning > 0) {
    const delta = currentTokens - state.tokenCountAtLastWarning
    // Require at least 5% more tokens before warning again
    if (delta < tokenBudget * 0.05) return false
  }

  return true
}

/**
 * Suppress warnings for the configured duration.
 * Call this AFTER emitting a warning to start the suppression window.
 */
export function suppressCompactWarning(
  state: CompactWarningState,
  currentTokens: number,
): CompactWarningState {
  return {
    lastWarningAt: Date.now(),
    suppressed: true,
    tokenCountAtLastWarning: currentTokens,
  }
}

/**
 * Clear warning suppression — called after a compaction actually runs,
 * because the content has changed and future warnings should be fresh.
 */
export function clearCompactWarningSuppression(
  state: CompactWarningState,
): CompactWarningState {
  return {
    ...state,
    suppressed: false,
    // Don't reset lastWarningAt — keeps tracking for analytics
  }
}

/**
 * Check if the suppression window has expired (async timer pattern).
 * Call this periodically to auto-clear suppression.
 */
export function maybeClearSuppression(
  state: CompactWarningState,
  config: Partial<CompactWarningConfig> = {},
): CompactWarningState {
  if (!state.suppressed) return state
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const elapsed = Date.now() - state.lastWarningAt
  if (elapsed >= cfg.suppressMs) {
    return { ...state, suppressed: false }
  }
  return state
}
