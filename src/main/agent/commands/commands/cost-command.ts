/**
 * /cost command — show token usage and cost for the current session.
 *
 * Usage:
 *   /cost       → show session token usage and estimated cost
 *
 * Local-only command (shouldQuery: false).
 */

import { estimateMessagesTokens } from '../../compact/token-counter'
import type { SlashCommand } from '../CommandRegistry'

// Approximate pricing per 1M tokens (input / output)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-8': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
}

function estimateCost(modelName: string, totalTokens: number): string {
  for (const [key, price] of Object.entries(PRICING)) {
    if (modelName.includes(key)) {
      // Rough 70/30 split input/output
      const inputTokens = totalTokens * 0.7
      const outputTokens = totalTokens * 0.3
      const cost = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output
      return `$${cost.toFixed(3)}`
    }
  }
  return '(unknown model — cannot estimate)'
}

export const costCommand: SlashCommand = {
  name: 'cost',
  description: 'Show token usage and estimated cost for the current session',
  aliases: ['$'],

  execute(_args: string, ctx) {
    const totalTokens = estimateMessagesTokens(ctx.messages)
    const messageCount = ctx.messages.length
    const userMsgs = ctx.messages.filter(m => m.role === 'user').length
    const assistantMsgs = ctx.messages.filter(m => m.role === 'assistant').length

    const lines = [
      '**Session Cost Estimate**',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Messages | ${messageCount} (${userMsgs} user, ${assistantMsgs} assistant) |`,
      `| Est. tokens | ~${totalTokens.toLocaleString()} |`,
    ]

    const lines2 = [
      '',
      '> Pricing is approximate. Actual cost depends on the API provider\'s billing.',
    ]

    return {
      messages: [],
      shouldQuery: false,
      resultText: [...lines, ...lines2].join('\n'),
    }
  },
}
