/**
 * token-budget — Token budget mechanics guidance for the LLM.
 *
 * Priority 150: after scratchpad, before summarize-results. Mirrors
 * Claude Code's feature('TOKEN_BUDGET') section. Tells the model how
 * token budgets work so it can plan its work productively.
 *
 * The backend TokenBudgetTracker (orchestrator/token-budget.ts) enforces
 * three heuristics: completion threshold, diminishing returns, hard cap.
 * This section gives the model the user-facing contract.
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const tokenBudgetSection: PromptSection = {
  name: 'token-budget',
  priority: 150,
  content: (ctx: PromptContext) => {
    if (!ctx.tokenBudget) return ''
    return `# Token Budget

When the user specifies a token target (e.g., "+500k", "spend 2M tokens", "use 1B tokens"), your output token count will be shown each turn. Keep working until you approach the target — plan your work to fill it productively. The target is a hard minimum, not a suggestion. If you stop early, the system will automatically continue you.`
  },
  condition: (ctx: PromptContext) => !!ctx.tokenBudget,
}
