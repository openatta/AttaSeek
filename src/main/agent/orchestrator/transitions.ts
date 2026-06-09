/**
 * transitions — Terminal and Continue discriminated unions for the query loop.
 *
 * Mirrors Claude Code's query/transitions.ts patterns. Together with AgentState,
 * these types make every loop exit reason explicit and traceable.
 *
 * Terminal: why the loop ended (one-shot).
 * Continue: why the loop kept going (accumulated across iterations).
 * RecoveryLevel: internal error recovery strategy (preserved from AgentState).
 */

// ── Terminal reasons (why the query loop exited) ──

/**
 * Terminal reasons align with the design doc and expand the existing
 * TerminalReason list with token budget and provider exhaustion cases.
 */
export type TerminalReason =
  | 'completed'           // Normal completion — end_turn with no tool_use
  | 'max_turns'           // Reached profile.execution.maxTurns
  | 'aborted'             // User cancelled via interrupt()
  | 'denied'              // Tool permission denied by user
  | 'model_error'         // Unrecoverable LLM error after all recovery exhausted
  | 'blocking_limit'      // Context exceeded and compaction disabled/ineffective
  | 'no_provider'         // No LLM provider configured or all providers exhausted
  | 'token_budget_exhausted'  // Token budget cap reached (task_budget or per-turn budget)
  | 'budget_exhausted'       // USD cost budget cap reached

/** Human-readable label for each terminal reason. */
export const TERMINAL_LABELS: Record<TerminalReason, string> = {
  completed: 'Completed',
  max_turns: 'Max turns reached',
  aborted: 'Cancelled by user',
  denied: 'Tool permission denied',
  model_error: 'Model error',
  blocking_limit: 'Context limit exceeded',
  no_provider: 'No provider available',
  token_budget_exhausted: 'Token budget exhausted',
  budget_exhausted: 'USD cost budget exhausted',
}

// ── Continue reasons (why the query loop kept going) ──

/**
 * Each continue site in the query loop assigns one of these reasons.
 * The `transition` field on AgentState records the most recent reason,
 * making recovery paths testable without inspecting message contents.
 */
export type ContinueReason =
  | 'tool_use_found'                // Tool use blocks detected → execute and continue
  | 'max_output_tokens_recovery'    // Hit output limit → upgrade max_tokens and retry
  | 'reactive_compact_recovery'     // Prompt-too-long → compacted → retry with same params
  | 'fallback_model_recovery'       // Primary model failed → switched to fallback
  | 'retry_recovery'                // Transient error → retried transparently
  | 'wait_retry_recovery'           // Rate-limit → waited → retried
  | 'context_collapse_recovery'     // Aggressive truncation → retry with minimal context
  | 'token_budget_continuation'     // Token budget has remaining capacity → continue
  | 'snip_applied'                  // Snip compaction removed middle messages (head+tail preserved)
  | 'time_microcompact_applied'     // Time-based microcompact cleared old tool results
  | 'collapse_applied'              // Non-destructive context collapse archived old messages
  | 'auto_compact_applied'          // LLM-based auto-compact summarised early turns
  | 'compact_warning_emitted'       // Compaction warning shown (budget approaching threshold)
  | 'proactive_compact_applied'     // Proactive compaction pipeline ran (multi-stage)

/** Human-readable label for each continue reason. */
export const CONTINUE_LABELS: Record<ContinueReason, string> = {
  tool_use_found: 'Tool use found',
  max_output_tokens_recovery: 'Output token recovery',
  reactive_compact_recovery: 'Reactive compaction',
  fallback_model_recovery: 'Fallback model',
  retry_recovery: 'Transparent retry',
  wait_retry_recovery: 'Rate-limit wait',
  context_collapse_recovery: 'Context collapse',
  token_budget_continuation: 'Token budget continuation',
  snip_applied: 'Snip compaction',
  time_microcompact_applied: 'Time microcompact',
  collapse_applied: 'Context collapse',
  auto_compact_applied: 'Auto compaction',
  compact_warning_emitted: 'Compaction warning',
  proactive_compact_applied: 'Proactive compaction',
}

// ── Recovery level (preserved from existing AgentState) ──

/**
 * Internal error recovery strategy used by recoverFromError().
 * Distinct from ContinueReason — this is the action to take,
 * not the reason the action was triggered.
 */
export type RecoveryLevel =
  | 'retry'           // Transparent retry — same params, no wait
  | 'wait_retry'      // Wait for rate-limit reset, then retry
  | 'compact'         // Reactive compaction — summarize early turns
  | 'collapse'        // Aggressive context collapse — keep only last 2 turns
  | 'fail'            // Give up — all recovery strategies exhausted
