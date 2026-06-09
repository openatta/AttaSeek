/**
 * CostTracker — LLM usage cost tracking in USD.
 *
 * Tracks cumulative token consumption and calculates cost using
 * model-specific pricing tables. Supports both Anthropic and
 * OpenAI-compatible pricing models.
 *
 * Mirrors Claude Code's cost-tracker.ts (src/cost-tracker.ts) and
 * calculateUSDCost in src/services/api/claude.ts.
 */

// ── Pricing tables (USD per million tokens) ──

interface ModelPricing {
  /** USD per 1M input tokens */
  inputPerMTok: number
  /** USD per 1M output tokens */
  outputPerMTok: number
  /** USD per 1M cache-read tokens (Anthropic-specific) */
  cacheReadPerMTok?: number
  /** USD per 1M cache-write tokens (Anthropic-specific) */
  cacheWritePerMTok?: number
}

const PRICING: Record<string, ModelPricing> = {
  // ── Anthropic models ──
  'claude-opus-4-8':         { inputPerMTok: 15.00, outputPerMTok: 75.00,  cacheReadPerMTok: 1.50, cacheWritePerMTok: 7.50 },
  'claude-opus-4-6':         { inputPerMTok: 15.00, outputPerMTok: 75.00,  cacheReadPerMTok: 1.50, cacheWritePerMTok: 7.50 },
  'claude-opus-4-5':         { inputPerMTok: 15.00, outputPerMTok: 75.00,  cacheReadPerMTok: 1.50, cacheWritePerMTok: 7.50 },
  'claude-opus-4':           { inputPerMTok: 15.00, outputPerMTok: 75.00,  cacheReadPerMTok: 1.50, cacheWritePerMTok: 7.50 },
  'claude-sonnet-4-6':       { inputPerMTok: 3.00,  outputPerMTok: 15.00,  cacheReadPerMTok: 0.30, cacheWritePerMTok: 1.50 },
  'claude-sonnet-4-5':       { inputPerMTok: 3.00,  outputPerMTok: 15.00,  cacheReadPerMTok: 0.30, cacheWritePerMTok: 1.50 },
  'claude-sonnet-4':         { inputPerMTok: 3.00,  outputPerMTok: 15.00,  cacheReadPerMTok: 0.30, cacheWritePerMTok: 1.50 },
  'claude-haiku-4-5':        { inputPerMTok: 0.80,  outputPerMTok: 4.00,   cacheReadPerMTok: 0.08, cacheWritePerMTok: 0.40 },
  'claude-haiku-3-5':        { inputPerMTok: 0.80,  outputPerMTok: 4.00,   cacheReadPerMTok: 0.08, cacheWritePerMTok: 0.40 },
  // ── OpenAI models (approximate) ──
  'gpt-4o':                  { inputPerMTok: 2.50,  outputPerMTok: 10.00 },
  'gpt-4o-mini':             { inputPerMTok: 0.15,  outputPerMTok: 0.60 },
  'gpt-4-turbo':             { inputPerMTok: 10.00, outputPerMTok: 30.00 },
  // ── Open-source defaults (conservative) ──
  'deepseek-chat':           { inputPerMTok: 0.27,  outputPerMTok: 1.10 },
  'deepseek-reasoner':       { inputPerMTok: 0.55,  outputPerMTok: 2.19 },
}

const FALLBACK_PRICING: ModelPricing = { inputPerMTok: 1.00, outputPerMTok: 5.00 }

// ── Types ──

export interface CostEntry {
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  costUSD: number
  timestamp: number
}

export interface CostSummary {
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  totalCostUSD: number
  entries: CostEntry[]
}

// ── Implementation ──

export class CostTracker {
  private entries: CostEntry[] = []
  private sessionTotal = 0

  /**
   * Record token usage and calculate cost.
   *
   * @param model       - Model identifier (resolved to pricing via fuzzy match).
   * @param inputTokens - Number of input tokens consumed.
   * @param outputTokens - Number of output tokens consumed.
   * @param cacheReadTokens - Number of cache-read tokens (Anthropic).
   * @param cacheWriteTokens - Number of cache-write tokens (Anthropic).
   * @returns The calculated USD cost for this entry.
   */
  recordUsage(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens?: number,
    cacheWriteTokens?: number,
  ): number {
    const pricing = resolvePricing(model)
    let cost = 0
    cost += (inputTokens / 1_000_000) * pricing.inputPerMTok
    cost += (outputTokens / 1_000_000) * pricing.outputPerMTok
    if (cacheReadTokens && pricing.cacheReadPerMTok) {
      cost += (cacheReadTokens / 1_000_000) * pricing.cacheReadPerMTok
    }
    if (cacheWriteTokens && pricing.cacheWritePerMTok) {
      cost += (cacheWriteTokens / 1_000_000) * pricing.cacheWritePerMTok
    }

    const entry: CostEntry = {
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      costUSD: cost,
      timestamp: Date.now(),
    }
    this.entries.push(entry)
    this.sessionTotal += cost
    return cost
  }

  /** Get the session cost summary. */
  getSessionSummary(): CostSummary {
    return {
      totalInputTokens: this.entries.reduce((s, e) => s + e.inputTokens, 0),
      totalOutputTokens: this.entries.reduce((s, e) => s + e.outputTokens, 0),
      totalCacheReadTokens: this.entries.reduce((s, e) => s + (e.cacheReadTokens ?? 0), 0),
      totalCacheWriteTokens: this.entries.reduce((s, e) => s + (e.cacheWriteTokens ?? 0), 0),
      totalCostUSD: this.sessionTotal,
      entries: [...this.entries],
    }
  }

  /** Total USD cost for this session. */
  get totalCost(): number {
    return this.sessionTotal
  }

  /** Reset the tracker for a new session. */
  reset(): void {
    this.entries = []
    this.sessionTotal = 0
  }

  /** Format a cost summary as a human-readable string. */
  formatCost(): string {
    const s = this.getSessionSummary()
    const parts: string[] = []
    if (s.totalInputTokens > 0) parts.push(`${(s.totalInputTokens / 1000).toFixed(1)}K in`)
    if (s.totalOutputTokens > 0) parts.push(`${(s.totalOutputTokens / 1000).toFixed(1)}K out`)
    parts.push(`$${s.totalCostUSD.toFixed(4)}`)
    return parts.join(' · ')
  }
}

// ── Pricing resolution ──

function resolvePricing(model: string): ModelPricing {
  // Exact match
  if (PRICING[model]) return PRICING[model]

  // Fuzzy match: strip date suffix (e.g., claude-sonnet-4-6-20251001 → claude-sonnet-4-6)
  const baseModel = model.replace(/-\d{8}$/, '')
  if (PRICING[baseModel]) return PRICING[baseModel]

  // Prefix match: find the longest matching prefix
  const matches = Object.keys(PRICING)
    .filter(k => model.startsWith(k) || k.startsWith(model))
    .sort((a, b) => b.length - a.length)

  if (matches.length > 0) return PRICING[matches[0]]

  return FALLBACK_PRICING
}

/** Singleton instance for the current session. */
export const costTracker = new CostTracker()
