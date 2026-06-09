/**
 * /status command — print session statistics without invoking the LLM.
 *
 * Usage:
 *   /status         → show session stats (message count, token estimate, model)
 *
 * This is a local-only command: shouldQuery is false, so the query loop
 * is bypassed entirely. The resultText is returned directly to the user.
 */

import { estimateMessagesTokens } from '../../compact/token-counter'
import type { SlashCommand } from '../CommandRegistry'

export const statusCommand: SlashCommand = {
  name: 'status',
  description: 'Show session statistics (message count, tokens, model)',

  execute(_args: string, ctx) {
    const messageCount = ctx.messages.length
    const estimatedTokens = estimateMessagesTokens(ctx.messages)
    const userMessages = ctx.messages.filter(m => m.role === 'user').length
    const assistantMessages = ctx.messages.filter(m => m.role === 'assistant').length

    const lines = [
      '**Session Status**',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Session ID | \`${ctx.sessionId}\` |`,
      `| Task ID | \`${ctx.taskId}\` |`,
      `| Messages | ${messageCount} (${userMessages} user, ${assistantMessages} assistant) |`,
      `| Est. tokens | ~${estimatedTokens.toLocaleString()} |`,
      `| Working dir | \`${ctx.cwd}\` |`,
    ]

    const text = lines.join('\n')

    return {
      messages: [],
      shouldQuery: false,
      resultText: text,
    }
  },
}
