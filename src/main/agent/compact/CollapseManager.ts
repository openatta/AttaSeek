/**
 * CollapseManager — orchestrates non-destructive context collapse.
 *
 * When the context is near its limit and compaction has already been
 * applied, collapse is the last resort: archive the oldest messages
 * into a CollapseStore commit, replace them with a summary, and
 * continue execution.
 *
 * Unlike snip (which permanently removes messages), collapse preserves
 * them in the store and projects a live view by replaying commit log.
 *
 * Mirrors Claude Code's contextCollapse (src/services/contextCollapse/index.ts).
 */

import { CollapseStore } from './CollapseStore'
import type { CollapseCommit } from './CollapseStore'
import { newId } from '../../store/id'
import type { LLMMessage } from '../llm/ModelProvider'
import type { AgentProfile } from '../profile/AgentProfile'
import { estimateMessagesTokens } from './token-counter'
import { snipCompact } from './SnipCompactor'
import { ID_PREFIX_LENGTH } from '../../../shared/constants'

// ── Types ──

export interface CollapseResult {
  /** Messages after collapse (summary + tail). */
  messages: LLMMessage[]
  /** Whether a new collapse was committed. */
  collapsed: boolean
  /** The new commit (if any). */
  newCommit?: CollapseCommit
  /** Estimated tokens freed (if a collapse happened). */
  tokensFreed: number
}

export interface CollapseConfig {
  /** Maximum number of collapse commits before refusing. */
  maxCommits: number
  /** Minimum messages that must remain in the live view. */
  minLiveMessages: number
  /** Trigger ratio — collapse when live messages exceed this % of budget. */
  triggerRatio: number
}

const DEFAULT_CONFIG: CollapseConfig = {
  maxCommits: 5,
  minLiveMessages: 4, // At least 2 turns
  triggerRatio: 0.95, // Trigger at 95% of token budget
}

// ── Manager ──

export class CollapseManager {
  private store: CollapseStore
  private config: CollapseConfig

  constructor(config: Partial<CollapseConfig> = {}) {
    this.store = new CollapseStore()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Check if collapse is needed and apply it.
   *
   * @param messages — current live messages
   * @param profile — agent profile (for budget limits)
   * @returns CollapseResult with potentially collapsed messages
   */
  applyCollapsesIfNeeded(
    messages: LLMMessage[],
    profile: AgentProfile,
  ): CollapseResult {
    const projected = this.store.projectLive(messages)
    const tokenBudget = profile.context.budgets?.messages ?? 60000

    // Don't collapse if we're under the trigger ratio
    const currentTokens = estimateMessagesTokens(projected.messages)
    if (currentTokens < tokenBudget * this.config.triggerRatio) {
      return { messages: projected.messages, collapsed: false, tokensFreed: 0 }
    }

    // Don't collapse if we've reached the max commits
    if (this.store.commitCount >= this.config.maxCommits) {
      return { messages: projected.messages, collapsed: false, tokensFreed: 0 }
    }

    // Don't collapse if we don't have enough messages
    if (messages.length <= this.config.minLiveMessages) {
      return { messages: projected.messages, collapsed: false, tokensFreed: 0 }
    }

    return this.collapse(messages, profile)
  }

  /**
   * Force a collapse — archive the oldest messages.
   * Keeps at least `minLiveMessages` in the live view.
   */
  collapse(
    messages: LLMMessage[],
    profile: AgentProfile,
  ): CollapseResult {
    // Determine how many to archive: roughly half, but keeping minLiveMessages
    const keepCount = Math.max(
      this.config.minLiveMessages,
      Math.floor(messages.length / 2),
    )
    const toArchive = messages.slice(0, messages.length - keepCount)
    const toKeep = messages.slice(-keepCount)

    if (toArchive.length === 0) {
      return { messages, collapsed: false, tokensFreed: 0 }
    }

    // Build a simple summary (LLM summarization deferred to Phase E)
    const archivedTokens = estimateMessagesTokens(toArchive)
    const summary = buildCollapseSummary(toArchive)

    // Commit
    const commit = this.store.commit(
      `collapse_${newId().slice(0, ID_PREFIX_LENGTH)}`,
      toArchive,
      summary,
      archivedTokens,
    )

    // Project the new live view
    const projected = this.store.projectLive(toKeep)

    return {
      messages: projected.messages,
      collapsed: true,
      newCommit: commit,
      tokensFreed: archivedTokens - estimateMessagesTokens(
        projected.messages.filter(m => m !== toKeep[0]),
      ),
    }
  }

  /** Force the most aggressive collapse possible (L4 recovery). */
  forceCollapse(
    messages: LLMMessage[],
    turnsToKeep: number = 2,
  ): CollapseResult {
    const keepCount = turnsToKeep * 2
    if (messages.length <= keepCount) {
      // Already minimal — apply snip instead
      const snipped = snipCompact(messages, { keepHead: 0, keepTailTurns: turnsToKeep, minMessages: 0 })
      return {
        messages: snipped.messages,
        collapsed: snipped.didSnip,
        tokensFreed: snipped.tokensFreed,
      }
    }

    return this.collapse(messages, {
      ...({ context: { budgets: { messages: 0 }, keepRecentTurns: turnsToKeep } } as unknown as AgentProfile),
    })
  }

  /** Get the collapse store for inspection. */
  getStore(): CollapseStore {
    return this.store
  }

  /** Reset all collapse state (session restart). */
  reset(): void {
    this.store.reset()
  }

  /**
   * Recover from a context overflow (real API 413).
   *
   * Drains all staged collapses and applies the most aggressive collapse
   * still available. This is the first line of defense before falling
   * through to reactive compact (which is more expensive: LLM summarization).
   *
   * Called from the query loop's prompt-too-long recovery path.
   *
   * @param messages — current live message array.
   * @returns Messages after drain + commit count. `committed` > 0 means
   *          the caller should retry the LLM call with the returned messages.
   */
  recoverFromOverflow(messages: LLMMessage[]): { messages: LLMMessage[]; committed: number } {
    const projected = this.store.projectLive(messages)

    // Count staged collapses before draining
    const stagedBefore = this.store.commitCount

    // Force-collapse: aggressively archive oldest messages to free up context
    const keepCount = this.config.minLiveMessages
    if (messages.length <= keepCount) {
      // Already minimal — no more collapses possible
      return { messages: projected.messages, committed: 0 }
    }

    const toArchive = messages.slice(0, messages.length - keepCount)
    const toKeep = messages.slice(-keepCount)

    if (toArchive.length === 0) {
      return { messages: projected.messages, committed: 0 }
    }

    const archivedTokens = estimateMessagesTokens(toArchive)
    const summary = buildCollapseSummary(toArchive)

    const commit = this.store.commit(
      `collapse_ovf_${newId().slice(0, ID_PREFIX_LENGTH)}`,
      toArchive,
      summary,
      archivedTokens,
    )

    const newProjected = this.store.projectLive(toKeep)
    const newCommits = this.store.commitCount - stagedBefore

    return {
      messages: newProjected.messages,
      committed: newCommits > 0 ? newCommits : (commit ? 1 : 0),
    }
  }

  /** Check if collapse is enabled (store exists and hasn't reached max commits). */
  isEnabled(): boolean {
    return this.store.commitCount < this.config.maxCommits
  }
}

// ── Summary builder (rule-based, LLM summarization in Phase E) ──

function buildCollapseSummary(messages: LLMMessage[]): string {
  const parts: string[] = []
  let userMessages = 0
  let assistantMessages = 0
  let toolCalls = 0

  // Extract key info without full LLM call
  const userContents: string[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      userMessages++
      const text = typeof msg.content === 'string'
        ? msg.content
        : msg.content
            .filter((b: unknown) => (b as { type: string }).type === 'text')
            .map((b: unknown) => (b as { text: string }).text)
            .join(' ')
      if (text) userContents.push(text.slice(0, 200))
    } else if (msg.role === 'assistant') {
      assistantMessages++
      if (Array.isArray(msg.content)) {
        for (const block of msg.content as { type: string }[]) {
          if (block.type === 'tool_use') toolCalls++
        }
      }
    }
  }

  parts.push(`Archived ${messages.length} messages (${userMessages} user, ${assistantMessages} assistant, ${toolCalls} tool calls).`)

  if (userContents.length > 0) {
    parts.push(`Key user goals: ${userContents.slice(0, 3).join(' | ')}`)
  }

  return parts.join('\n')
}
