/**
 * token-budget — Token budget tracking for the query loop.
 *
 * Tracks cumulative token consumption against a configurable budget and
 * emits terminal + continue signals based on three heuristics:
 *
 *   1. Completion threshold — turn tokens < budget * 0.9 → natural end
 *   2. Diminishing returns — 3+ continues with delta < 500 tokens → stop
 *   3. Hard cap — total >= budget → immediate termination
 *
 * Mirrors Claude Code's token budget system in src/query/tokenBudget.ts.
 */

// ── Types ──

export interface TokenBudgetConfig {
  /** Total token budget for this query (input + output tokens). */
  total: number
  /**
   * Fraction of budget below which the model should naturally end.
   * Default 0.9 — when turnTokens < budget * 0.9, consider wrapping up.
   */
  completionThreshold?: number
  /**
   * Minimum token delta per continue to avoid the diminishing-returns
   * signal. Default 500 tokens.
   */
  diminishingReturnsDelta?: number
  /**
   * Number of consecutive continues before the diminishing-returns
   * signal kicks in. Default 3.
   */
  diminishingReturnsStreak?: number
}

export interface TokenBudgetState {
  /** Cumulative input tokens consumed. */
  totalInputTokens: number
  /** Cumulative output tokens consumed. */
  totalOutputTokens: number
  /** How many times the loop has continued (tool_use → next turn). */
  continueCount: number
  /** Tokens consumed since the last continue check. */
  tokensSinceLastContinue: number
  /** Consecutive continues with sub-threshold delta. */
  lowDeltaStreak: number
  /** Whether the budget has been exhausted. */
  exhausted: boolean
  /** Remaining budget before compaction (snapshot taken at compact boundaries). */
  budgetBeforeCompact?: number
  /** Remaining budget after compaction (snapshot taken at compact boundaries). */
  budgetAfterCompact?: number
}

export type BudgetSignal =
  | 'continue'               // Budget has remaining capacity
  | 'approaching'            // Close to limit — consider wrapping up
  | 'diminishing_returns'    // Each continue adds too little value
  | 'exhausted'              // Hard cap reached

// ── Implementation ──

export class TokenBudgetTracker {
  readonly config: Required<TokenBudgetConfig>
  private state: TokenBudgetState

  constructor(config: TokenBudgetConfig) {
    this.config = {
      total: config.total,
      completionThreshold: config.completionThreshold ?? 0.9,
      diminishingReturnsDelta: config.diminishingReturnsDelta ?? 500,
      diminishingReturnsStreak: config.diminishingReturnsStreak ?? 3,
    }
    this.state = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      continueCount: 0,
      tokensSinceLastContinue: 0,
      lowDeltaStreak: 0,
      exhausted: false,
    }
  }

  /** Total tokens consumed so far. */
  get totalTokens(): number {
    return this.state.totalInputTokens + this.state.totalOutputTokens
  }

  /** Remaining budget. */
  get remaining(): number {
    return Math.max(0, this.config.total - this.totalTokens)
  }

  /** Fraction of budget consumed (0–1). */
  get consumedRatio(): number {
    return this.totalTokens / this.config.total
  }

  /** Record token consumption from an LLM call result. */
  recordUsage(inputTokens: number, outputTokens: number): void {
    this.state.totalInputTokens += inputTokens
    this.state.totalOutputTokens += outputTokens
  }

  /** Record a continue (tool_use → next turn). Call after each tool execution round. */
  recordContinue(turnTokens: number): void {
    this.state.continueCount++

    const delta = turnTokens - this.state.tokensSinceLastContinue
    this.state.tokensSinceLastContinue = turnTokens

    if (delta < this.config.diminishingReturnsDelta) {
      this.state.lowDeltaStreak++
    } else {
      this.state.lowDeltaStreak = 0
    }
  }

  /** Snapshot budget around a compaction boundary. */
  recordCompactBoundary(budgetBefore: number, budgetAfter: number): void {
    this.state.budgetBeforeCompact = budgetBefore
    this.state.budgetAfterCompact = budgetAfter
  }

  /**
   * Evaluate the current budget signal.
   * Call after each LLM turn to decide whether to continue.
   *
   * @param turnTokens — tokens consumed in this turn (input + output).
   */
  evaluate(turnTokens: number): BudgetSignal {
    const total = this.totalTokens

    // Hard cap check
    if (total >= this.config.total) {
      this.state.exhausted = true
      return 'exhausted'
    }

    // Completion threshold: model should naturally wrap up
    if (turnTokens > 0 && turnTokens < this.config.total * (1 - this.config.completionThreshold)) {
      return 'approaching'
    }

    // Diminishing returns: too many low-value continues
    if (
      this.state.continueCount >= this.config.diminishingReturnsStreak &&
      this.state.lowDeltaStreak >= this.config.diminishingReturnsStreak
    ) {
      return 'diminishing_returns'
    }

    return 'continue'
  }

  /**
   * Generate a meta continue message to inject into the conversation
   * when the budget is running low but there's still capacity.
   */
  buildContinueMessage(): string | undefined {
    const remaining = this.remaining
    const pct = Math.round(this.consumedRatio * 100)

    if (remaining <= 0) return undefined

    if (pct >= 90) {
      return `[Note: You have used ${pct}% of the token budget (${remaining.toLocaleString()} tokens remaining). Complete your work and summarize findings.]`
    }
    if (pct >= 70) {
      return `[Note: You have used ${pct}% of the token budget (${remaining.toLocaleString()} tokens remaining). Prioritize high-value work.]`
    }

    return undefined
  }

  /** Reset state for a new query (keeps config). */
  reset(): void {
    this.state = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      continueCount: 0,
      tokensSinceLastContinue: 0,
      lowDeltaStreak: 0,
      exhausted: false,
    }
  }
}
