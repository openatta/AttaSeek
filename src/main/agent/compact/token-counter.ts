/**
 * token-counter — Estimate token counts for context management.
 *
 * Uses character-based estimation: ceil(chars / 4).
 * Conservative for code-heavy text (4 chars per token is a common approximation).
 * Future: integrate with tiktoken or model-specific tokenizers for precision.
 */

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function estimateMessagesTokens(messages: { content: unknown }[]): number {
  let total = 0
  for (const m of messages) {
    total += estimateTokens(
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    )
  }
  return total
}

/** Check if total exceeds budget */
export function isOverBudget(used: number, budget: number, triggerRatio: number): boolean {
  return used > budget * triggerRatio
}
