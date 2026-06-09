/**
 * AgentState — execution state machine types for the query loop.
 *
 * Mirrors Claude Code's query loop State (src/query.ts) — mutable
 * cross-iteration state carried between loop iterations. The loop body
 * destructures this at the top of each iteration; continue sites write
 * `state = { ...state, ... }` to produce an immutable successor.
 *
 * Phase A: type expansion (backward-compatible).
 * Phase B: query-loop consumes the expanded fields.
 */

import type { LLMMessage } from '../llm/ModelProvider'
import type { AgentTask } from '../../../shared/types/AgentTask'
import type { AgentProfile } from '../profile/AgentProfile'
import type { ToolUseContext } from './QueryDeps'
import type { ContinueReason } from './transitions'

// Re-export transitions for convenience (backward-compatible)
export type { TerminalReason, RecoveryLevel, ContinueReason } from './transitions'

// ── Auto-compact tracking (hysteresis) ──

/**
 * Prevents repeated compaction attempts when the context is already
 * as compact as it can be. Reset when a real user/assistant turn
 * adds substantial new content.
 */
export interface AutoCompactTracking {
  /** Token count at the time of the last compaction */
  lastCompactTokenCount: number
  /** How many consecutive attempts were no-ops (already minimal) */
  consecutiveNoops: number
  /** Maximum allowed consecutive no-ops before disabling auto-compact */
  maxNoops: number
}

// ── Snip tracking ──

/** Tracks snip compaction state across loop iterations. */
export interface SnipTracking {
  /** Timestamp of the last snip (0 = never). */
  lastSnipAt: number
  /** Total messages removed by snip across the session. */
  totalRemovedBySnip: number
  /** Number of snip operations performed. */
  snipCount: number
}

// ── Time microcompact state ──

/** Tracks when the last assistant message was produced (for time-gap detection). */
export interface TimeMicrocompactState {
  /** Timestamp (ms) of the most recent assistant message. 0 = unknown. */
  lastAssistantTimestamp: number
  /** Timestamp (ms) of the most recent time-microcompact run. 0 = never. */
  lastTimeMicrocompactAt: number
  /** Total tool results cleared by time-microcompact across the session. */
  totalClearedByTimeMC: number
}

// ── Compaction warning state ──

/**
 * Prevents repeated compaction warnings within a suppression window.
 * Reset when a compaction actually runs (the warning served its purpose).
 */
export interface CompactWarningState {
  /** Timestamp (ms) of the last warning emitted. 0 = never. */
  lastWarningAt: number
  /** Whether warning suppression is active. */
  suppressed: boolean
  /** Token count at the time of the last warning (for delta tracking). */
  tokenCountAtLastWarning: number
}

// ── Compaction info ──

/** Summary of the last compaction that was applied. */
export interface CompactInfo {
  /** Compacted conversation summary (replaces removed messages in system prompt) */
  summary: string
  /** Token count saved by the compaction */
  tokensFreed: number
  /** Number of messages compacted away */
  removedMessageCount: number
  /** Timestamp of compaction */
  at: number
}

// ── State ──

export interface AgentState {
  /** The task being executed */
  task: AgentTask

  /** Agent profile driving behaviour */
  profile: AgentProfile

  /** Accumulated conversation messages (assistant + tool results appended each turn) */
  messages: LLMMessage[]

  /** Current system prompt (may be mutated by hooks between turns) */
  systemPrompt: string

  /** Turn counter — incremented after each LLM call + tool execution round */
  turnCount: number

  /** Cumulative input tokens consumed across all turns */
  totalInputTokens: number

  /** Cumulative output tokens produced across all turns */
  totalOutputTokens: number

  /** Count of tool uses executed so far */
  toolUseCount: number

  /** Summary from the most recent compaction (empty string = no compaction yet) */
  compactSummary?: string

  /** Last compaction metadata */
  lastCompact?: CompactInfo

  // ── Phase A additions (aligned with CC State) ──

  /**
   * Mutable tool-use context shared across tools within a turn.
   * Reset each queryLoop invocation.
   */
  toolUseContext: ToolUseContext

  /**
   * Auto-compact hysteresis tracking — prevents thrashing when
   * context is already minimal.
   */
  autoCompactTracking?: AutoCompactTracking

  /**
   * Number of max_output_tokens recoveries attempted.
   * Reset at turn start. Maximum 3 before giving up.
   */
  maxOutputTokensRecoveryCount: number

  /**
   * Whether reactive compaction has been attempted for this turn.
   * Prevents double-compacting on the same error.
   */
  hasAttemptedReactiveCompact: boolean

  /**
   * Output token override applied (escalated from default).
   * undefined = use provider default.
   */
  maxOutputTokensOverride?: number

  /**
   * Why the previous iteration continued (undefined on first iteration).
   * Makes recovery paths testable without inspecting message contents.
   */
  transition: ContinueReason | undefined

  /**
   * Whether a stop hook is currently active.
   */
  stopHookActive: boolean

  /**
   * Pending tool-use summary (generated asynchronously, consumed
   * before next LLM call). undefined = none pending.
   */
  pendingToolUseSummary?: Promise<unknown>

  // ── Phase E additions (compaction pipeline integration) ──

  /**
   * Snip compaction tracking — records snip operations across the session.
   */
  snipTracking: SnipTracking

  /**
   * Time-based microcompact state — tracks assistant message timestamps
   * for detecting cache-expiry gaps.
   */
  timeMicrocompactState: TimeMicrocompactState

  /**
   * Compaction warning state — prevents repeated warnings within
   * the suppression window.
   */
  compactWarningState: CompactWarningState

  /**
   * Compaction pipeline tracking — hysteresis state for the full
   * 5-stage pipeline (carried across loop iterations).
   */
  pipelineTracking?: import('../compact/CompactionPipeline').PipelineTracking

  /**
   * Collapse manager instance — persists across turns to maintain
   * the commit log for non-destructive context archiving.
   */
  collapseManager?: import('../compact/CollapseManager').CollapseManager
}

// ── Factory ──

/** The default tool-use context value (placeholder until Phase D wires real one). */
function defaultToolUseContext(): ToolUseContext {
  const parentController = new AbortController()
  return {
    abortController: parentController,
    siblingAbortController: new AbortController(), // child of parent
    setInProgressToolUseIDs: () => {},
  }
}

/**
 * Create the initial state for a new task execution.
 * All counters start at zero; messages and system prompt are populated
 * later by ContextAssembly.
 */
export function createInitialState(task: AgentTask, profile: AgentProfile): AgentState {
  return {
    task,
    profile,
    messages: [],
    systemPrompt: '',
    turnCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    toolUseCount: 0,
    // Phase A additions
    toolUseContext: defaultToolUseContext(),
    maxOutputTokensRecoveryCount: 0,
    hasAttemptedReactiveCompact: false,
    stopHookActive: false,
    transition: undefined,
    // Phase E additions
    snipTracking: { lastSnipAt: 0, totalRemovedBySnip: 0, snipCount: 0 },
    timeMicrocompactState: { lastAssistantTimestamp: 0, lastTimeMicrocompactAt: 0, totalClearedByTimeMC: 0 },
    compactWarningState: { lastWarningAt: 0, suppressed: false, tokenCountAtLastWarning: 0 },
  }
}

// ── State helpers (Phase A — used in Phase B query-loop) ──

/** Reset per-turn fields at the start of each queryLoop invocation. */
export function resetPerTurn(state: AgentState): AgentState {
  return {
    ...state,
    maxOutputTokensRecoveryCount: 0,
    hasAttemptedReactiveCompact: false,
    maxOutputTokensOverride: undefined,
    transition: undefined,
    stopHookActive: false,
    pendingToolUseSummary: undefined,
    // Preserve compaction tracking across turns (these are session-scoped)
  }
}

/** Record a continue transition for observability and testing. */
export function withTransition(state: AgentState, reason: ContinueReason): AgentState {
  return { ...state, transition: reason }
}
