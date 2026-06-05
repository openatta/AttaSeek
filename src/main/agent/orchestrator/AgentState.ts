/**
 * AgentState — execution state machine types for AgentOrchestrator.
 *
 * Inspired by Claude Code's query loop State + Continue + Terminal pattern.
 * The state is immutable — each iteration produces a new State.
 */

import type { LLMMessage, LLMToolUseBlock } from '../llm/LLMProvider'
import type { AgentTask } from '../../../shared/types/AgentTask'
import type { AgentProfile } from '../profile/AgentProfile'

// ── State ──

export interface AgentState {
  task: AgentTask
  profile: AgentProfile
  messages: LLMMessage[]
  systemPrompt: string
  toolUseBlocks: LLMToolUseBlock[]
  turnCount: number
  totalInputTokens: number
  totalOutputTokens: number
  toolUseCount: number
  compactSummary?: string
}

export function createInitialState(task: AgentTask, profile: AgentProfile): AgentState {
  return {
    task,
    profile,
    messages: [],
    systemPrompt: '',
    toolUseBlocks: [],
    turnCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    toolUseCount: 0,
  }
}

// ── Terminal reasons ──

export type TerminalReason =
  | 'completed'       // Normal completion (end_turn)
  | 'max_turns'       // Reached max turn limit
  | 'aborted'         // User cancelled
  | 'denied'          // Tool permission denied
  | 'model_error'     // Unrecoverable model error
  | 'blocking_limit'  // Context exceeded and compact disabled
  | 'no_provider'     // No LLM provider configured

// ── Recovery level for LLM errors ──

export type RecoveryLevel =
  | 'retry'           // Transparent retry (1x)
  | 'wait_retry'      // Wait then retry (rate limits)
  | 'collapse'        // Context collapse
  | 'compact'         // Reactive compaction
  | 'fail'            // Give up
