/**
 * ContextCompactor — backward-compatible re-exports from Phase C modules.
 *
 * All original function signatures are preserved for backward compatibility.
 * They delegate to the new Phase C modules internally.
 *
 * @deprecated Prefer importing from the specific Phase C modules directly:
 *   - `shouldCompact` / `compactConversation` → `./AutoCompactor`
 *   - `microcompact` → `./Microcompactor`
 *   - `isContextLengthError` / `reactiveCompact` → `./ReactiveCompactor`
 */

import type { LLMMessage } from '../llm/ModelProvider'
import type { AgentProfile } from '../profile/AgentProfile'
import { shouldAutoCompact } from './AutoCompactor'
import { autoCompact } from './AutoCompactor'
import type { AutoCompactOptions } from './AutoCompactor'
import { microcompactResults } from './Microcompactor'
import { isContextLengthError as _isCLE, reactiveCompact as _reactiveCompact } from './ReactiveCompactor'
import { estimateMessagesTokens, isOverBudget } from './token-counter'

// ── Types (backward-compatible shape) ──

export interface CompactOptions {
  compactModel?: string
  providerId?: string
}

export interface CompactResult {
  summary: string
  compactedMessages: LLMMessage[]
  tokenSaved: number
  compactedCount: number
}

// ── Re-exports (original signatures, backward-compatible) ──

/**
 * Check if compaction is needed.
 * @deprecated Use `shouldAutoCompact` from `./AutoCompactor` (adds hysteresis tracking).
 */
export function shouldCompact(messages: LLMMessage[], profile: AgentProfile): boolean {
  const used = estimateMessagesTokens(messages)
  return isOverBudget(used, profile.context.budgets.messages, profile.context.compactTriggerRatio)
}

/**
 * Compact conversation — keep recent N turns, LLM-summarize the rest.
 * @deprecated Use `autoCompact` from `./AutoCompactor` (field names differ — see migration note).
 */
export async function compactConversation(
  messages: LLMMessage[],
  profile: AgentProfile,
  existingSummary?: string,
  opts?: CompactOptions,
): Promise<CompactResult> {
  const autoOpts: AutoCompactOptions = opts ? { compactModel: opts.compactModel, providerId: opts.providerId } : {}
  const result = await autoCompact(messages, profile, existingSummary, autoOpts)
  return {
    summary: result.summary,
    compactedMessages: result.messages,
    tokenSaved: result.tokensFreed,
    compactedCount: result.compressedCount,
  }
}

/**
 * Microcompact — truncate individual tool results.
 * @deprecated Use `microcompactResults` from `./Microcompactor`.
 */
export function microcompact(toolResults: { content: string }[]): { content: string }[] {
  return microcompactResults(toolResults)
}

/**
 * Check if an error is a context-length error.
 * @deprecated Use `isContextLengthError` from `./ReactiveCompactor`.
 */
export { isContextLengthError } from './ReactiveCompactor'

/**
 * Reactive compact — aggressive compaction triggered by API errors.
 * Wraps the new ReactiveCompactor with backward-compatible field names.
 * @deprecated Use `reactiveCompact` from `./ReactiveCompactor` directly (field names differ).
 */
export async function reactiveCompact(
  messages: LLMMessage[],
  profile: AgentProfile,
  existingSummary?: string,
): Promise<CompactResult> {
  const result = await _reactiveCompact(messages, profile, existingSummary)
  return {
    summary: result.summary,
    compactedMessages: result.messages,
    tokenSaved: result.tokensFreed,
    compactedCount: result.compressedCount,
  }
}
