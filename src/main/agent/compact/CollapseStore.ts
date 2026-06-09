/**
 * CollapseStore — in-memory commit log for non-destructive context collapse.
 *
 * Mirrors Claude Code's context collapse (src/services/contextCollapse/).
 * Each collapse creates a "commit" recording what messages were collapsed
 * and a summary. On the next loop entry, the commit log is replayed to
 * produce the collapsed view — this way the collapsed state persists
 * across turns without mutating the original message history.
 *
 * Collapse is non-destructive: the original messages are preserved in the
 * commit log. The projected view is built by replaying all commits.
 */

import type { LLMMessage } from '../llm/ModelProvider'

// ── Types ──

export interface CollapseCommit {
  /** Unique commit identifier. */
  id: string
  /** Messages removed from the live view (archived). */
  archivedMessages: LLMMessage[]
  /** Summary that replaces the archived messages. */
  summary: string
  /** Timestamp when this collapse was committed. */
  at: number
  /** Token count of archived messages (for reporting). */
  archivedTokens: number
}

export interface CollapseState {
  /** Ordered list of collapse commits (oldest first). */
  commits: CollapseCommit[]
  /** Total archived token count across all commits. */
  totalArchivedTokens: number
  /** Total archived message count. */
  totalArchivedMessages: number
}

// ── Store ──

export class CollapseStore {
  private state: CollapseState = {
    commits: [],
    totalArchivedTokens: 0,
    totalArchivedMessages: 0,
  }

  /** Commit a collapse — archive messages and record summary. */
  commit(
    id: string,
    archivedMessages: LLMMessage[],
    summary: string,
    archivedTokens: number,
  ): CollapseCommit {
    const commit: CollapseCommit = {
      id,
      archivedMessages,
      summary,
      at: Date.now(),
      archivedTokens,
    }
    this.state.commits.push(commit)
    this.state.totalArchivedTokens += archivedTokens
    this.state.totalArchivedMessages += archivedMessages.length
    return commit
  }

  /**
   * Project the live message view by replaying all commits.
   * Returns the messages that should be visible after all collapses.
   *
   * The projection: start with the current live messages, then for each
   * commit, replace the archived range with the summary message.
   *
   * FOR NOW: simplified — returns a compact view with just the summary
   * message preceding the current live tail. Full range-replacement
   * requires message ID tracking (Phase D).
   */
  projectLive(
    liveMessages: LLMMessage[],
  ): { messages: LLMMessage[]; summaryHeader?: string } {
    if (this.state.commits.length === 0) {
      return { messages: liveMessages }
    }

    // Build a combined summary from all commits
    const combinedSummary = this.state.commits
      .map((c, i) => `[Collapse #${i + 1} (${c.archivedMessages.length} msgs, ~${c.archivedTokens} tokens)]\n${c.summary}`)
      .join('\n\n')

    // Prepend summary to live messages
    const summaryMsg: LLMMessage = {
      role: 'user',
      content: `[Collapsed context — ${this.state.totalArchivedMessages} messages archived across ${this.state.commits.length} collapse(s)]\n\n${combinedSummary}`,
    }

    return {
      messages: [summaryMsg, ...liveMessages],
      summaryHeader: combinedSummary,
    }
  }

  /** Get the current collapse state (read-only). */
  getState(): Readonly<CollapseState> {
    return this.state
  }

  /** Number of commits. */
  get commitCount(): number {
    return this.state.commits.length
  }

  /** Total tokens archived across all commits. */
  get totalTokensArchived(): number {
    return this.state.totalArchivedTokens
  }

  /** Clear all collapse state (session reset). */
  reset(): void {
    this.state = {
      commits: [],
      totalArchivedTokens: 0,
      totalArchivedMessages: 0,
    }
  }
}
