/**
 * CompactionPipeline — orchestrates the 5-stage compaction sequence.
 *
 * Pipeline (cheapest → most expensive):
 *   1. Snip           — remove middle conversation, keep head+tail
 *   2. Microcompact   — truncate long tool results + remove old pairs
 *   3. Collapse       — non-destructive archive of oldest messages
 *   4. Auto-compact   — LLM-based summarization (with hysteresis)
 *   5. Reactive       — API-error triggered aggressive compaction
 *
 * Each stage runs only if needed. The pipeline stops after the first
 * stage that performs a meaningful compaction (to avoid over-trimming).
 * Exception: Snip + Microcompact can both run (they're orthogonal).
 *
 * Phase C: full 5-stage implementation replacing the Phase B stub.
 */

import { snipCompact } from './SnipCompactor'
import type { SnipConfig } from './SnipCompactor'
import { microcompactMessages, timeMicrocompact } from './Microcompactor'
import type { MicrocompactResult } from './Microcompactor'
import { CollapseManager } from './CollapseManager'
import type { CollapseResult } from './CollapseManager'
import { autoCompactIfNeeded, shouldAutoCompact, createAutoCompactTracking } from './AutoCompactor'
import type { AutoCompactResult, AutoCompactTracking, AutoCompactOptions } from './AutoCompactor'
import { reactiveCompact, isContextLengthError } from './ReactiveCompactor'
import type { ReactiveCompactResult } from './ReactiveCompactor'
import type { LLMMessage } from '../llm/ModelProvider'
import type { AgentProfile } from '../profile/AgentProfile'

// ── Types ──

export interface PipelineResult {
  /** Messages after pipeline processing. */
  messages: LLMMessage[]
  /** Summary from the last compaction stage that ran. */
  summary: string
  /** Total tokens freed across all stages. */
  totalTokensFreed: number
  /** Total messages compacted/removed. */
  totalCompressedCount: number
  /** Which stages produced a compaction (in order). */
  stagesApplied: string[]
  /** Updated auto-compact tracking (feed into next call). */
  autoCompactTracking: AutoCompactTracking
}

export interface PipelineConfig {
  /** Snip configuration. */
  snip?: Partial<SnipConfig>
  /** Auto-compact model override options. */
  autoCompact?: AutoCompactOptions
  /** Collapse manager (pass your own to persist across turns). */
  collapseManager?: CollapseManager
  /** Existing auto-compact hysteresis state. */
  autoCompactTracking?: AutoCompactTracking
  /** Existing compaction summary. */
  existingSummary?: string
}

/**
 * CompactionConfig — static compaction policy for AgentConfig.
 *
 * Unlike PipelineConfig (which carries per-call mutable state), this
 * captures the static thresholds and strategy choices. The query loop
 * derives PipelineConfig from this + its own runtime state.
 */
export interface CompactionConfig {
  /** Whether auto-compaction is enabled. */
  autoCompact: boolean
  /** Token ratio at which compaction triggers (0.0–1.0). Default 0.85. */
  compactTriggerRatio: number
  /** Recent turns kept after compaction. */
  keepRecentTurns: number
  /** Whether snip compaction is enabled. */
  snipEnabled: boolean
  /** Whether microcompact (tool result truncation) is enabled. */
  microcompactEnabled: boolean
  /** Whether context collapse is enabled. */
  collapseEnabled: boolean
  /** Whether reactive compaction (API-error-triggered) is enabled. */
  reactiveEnabled: boolean
}

/**
 * PipelineTracking — mutable state carried across loop iterations.
 * Feeds into PipelineConfig on the next call so hysteresis and
 * collapse commit logs are preserved.
 */
export interface PipelineTracking {
  /** Auto-compact hysteresis — prevents thrashing. */
  autoCompactTracking: AutoCompactTracking
  /** Accumulated compaction summary (LLM-generated). */
  summary: string
  /** Which stages have been applied in this session (for analytics). */
  sessionStagesApplied: string[]
  /** Total tokens freed across all compactions this session. */
  sessionTotalTokensFreed: number
  /** Total messages compacted this session. */
  sessionTotalCompressedCount: number
}

/** Create a fresh pipeline tracking state. */
export function createPipelineTracking(): PipelineTracking {
  return {
    autoCompactTracking: createAutoCompactTracking(),
    summary: '',
    sessionStagesApplied: [],
    sessionTotalTokensFreed: 0,
    sessionTotalCompressedCount: 0,
  }
}

// ── Pipeline ──

/**
 * Run the full 5-stage compaction pipeline.
 *
 * Stages 1-2 (snip, microcompact) are cheap and deterministic — they always
 * run if there's work to do. Stage 3-4 (collapse, auto-compact) are
 * progressively more expensive and run only if budget is still exceeded.
 * Stage 5 (reactive) is only triggered by API errors externally.
 *
 * Call this BEFORE the LLM call in the query loop.
 */
export async function runCompactionPipeline(
  messages: LLMMessage[],
  profile: AgentProfile,
  config: PipelineConfig = {},
  tracking?: PipelineTracking,
): Promise<PipelineResult & { tracking: PipelineTracking }> {
  const stagesApplied: string[] = []
  let currentMessages = messages
  let totalTokensFreed = 0
  let totalCompressedCount = 0
  let summary = config.existingSummary || tracking?.summary || ''
  let autoTrack = config.autoCompactTracking || tracking?.autoCompactTracking || createAutoCompactTracking()

  // Initialize tracking if not provided
  const pipeTracking: PipelineTracking = tracking || createPipelineTracking()

  // ── Stage 1: Snip — remove middle, keep head+tail ──
  const snipResult = snipCompact(currentMessages, config.snip)
  if (snipResult.didSnip) {
    currentMessages = snipResult.messages
    totalTokensFreed += snipResult.tokensFreed
    totalCompressedCount += snipResult.removedCount
    stagesApplied.push('snip')
  }

  // ── Stage 2: Microcompact — truncate + time-based removal ──
  // Content microcompact (always worth doing)
  const microResult = microcompactMessages(currentMessages)
  if (microResult.compactedCount > 0) {
    currentMessages = microResult.messages
    totalTokensFreed += microResult.tokensFreed
    totalCompressedCount += microResult.compactedCount
    stagesApplied.push('microcompact')
  }

  // Time microcompact (for long conversations)
  if (currentMessages.length > 20) {
    const timeResult = timeMicrocompact(currentMessages)
    if (timeResult.compactedCount > 0) {
      currentMessages = timeResult.messages
      totalTokensFreed += timeResult.tokensFreed
      totalCompressedCount += timeResult.compactedCount
      stagesApplied.push('time-microcompact')
    }
  }

  // ── Stage 3: Collapse — non-destructive archive ──
  const collapseMgr = config.collapseManager
  if (collapseMgr) {
    const collapseResult = collapseMgr.applyCollapsesIfNeeded(currentMessages, profile)
    if (collapseResult.collapsed) {
      currentMessages = collapseResult.messages
      totalTokensFreed += collapseResult.tokensFreed
      if (collapseResult.newCommit) {
        totalCompressedCount += collapseResult.newCommit.archivedMessages.length
      }
      stagesApplied.push('collapse')
    }
  }

  // ── Stage 4: Auto-compact — LLM summarization (with hysteresis) ──
  if (shouldAutoCompact(currentMessages, profile, autoTrack)) {
    const autoResult = await autoCompactIfNeeded(currentMessages, profile, autoTrack, summary, config.autoCompact)
    if (autoResult && autoResult.didCompact) {
      currentMessages = autoResult.messages
      summary = autoResult.summary
      totalTokensFreed += autoResult.tokensFreed
      totalCompressedCount += autoResult.compressedCount
      stagesApplied.push('auto-compact')
      autoTrack.lastCompactTokenCount = 0 // Will be set after turn
      autoTrack.consecutiveNoops = 0
    } else {
      autoTrack.consecutiveNoops++
    }
  }

  // Update pipeline tracking
  pipeTracking.autoCompactTracking = autoTrack
  pipeTracking.summary = summary
  if (stagesApplied.length > 0) {
    pipeTracking.sessionStagesApplied = [...new Set([...pipeTracking.sessionStagesApplied, ...stagesApplied])]
    pipeTracking.sessionTotalTokensFreed += totalTokensFreed
    pipeTracking.sessionTotalCompressedCount += totalCompressedCount
  }

  return {
    messages: currentMessages,
    summary,
    totalTokensFreed,
    totalCompressedCount,
    stagesApplied,
    autoCompactTracking: autoTrack,
    tracking: pipeTracking,
  }
}

/**
 * Run reactive compaction in response to an API error.
 * Call this AFTER an LLM error in the query loop.
 */
export async function runReactiveCompaction(
  messages: LLMMessage[],
  profile: AgentProfile,
  error: unknown,
  existingSummary?: string,
): Promise<ReactiveCompactResult> {
  if (!isContextLengthError(error)) {
    return {
      messages,
      summary: existingSummary || '',
      tokensFreed: 0,
      compressedCount: 0,
      strategy: 'none',
    }
  }
  return reactiveCompact(messages, profile, existingSummary, error)
}

// ── Legacy exports (re-used by ContextCompactor for backward compat) ──

// Re-export these types so downstream code isn't broken
export type { SnipResult } from './SnipCompactor'
export type { CollapseResult } from './CollapseManager'
export type { AutoCompactResult } from './AutoCompactor'
export type { ReactiveCompactResult } from './ReactiveCompactor'
export { isContextLengthError, isMediaSizeError, isWithheldPromptTooLong, isWithheldMediaSizeError, tryReactiveCompact } from './ReactiveCompactor'
export { shouldAutoCompact, createAutoCompactTracking } from './AutoCompactor'

// ── New Phase E exports ──

// Note: createPipelineTracking is defined above in this file.
export type { CompactWarningState } from './CompactWarningState'
export { createCompactWarningState, shouldEmitCompactWarning, suppressCompactWarning, clearCompactWarningSuppression, maybeClearSuppression } from './CompactWarningState'
export { FileStateCache, getFileStateCache, resetFileStateCache } from './FileStateCache'
export type { CachedFileEntry, CacheStats } from './FileStateCache'
export type { EditorBridge, EditorRange, EditorPosition, EditorEdit, EditorDiff } from './EditorBridge'
export { NOOP_EDITOR_BRIDGE, registerEditorBridge, getEditorBridge, resetEditorBridge } from './EditorBridge'
export { getLastAssistantTimestamp, shouldTimeMicrocompact, microcompactWithTime } from './Microcompactor'
