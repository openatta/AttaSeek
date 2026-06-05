/**
 * tools-usage — Tool usage guidelines and available tools listing.
 *
 * Priority 20: after identity, before skills and memory.
 */

import type { PromptSection, PromptContext } from '../PromptTemplate'

export const toolsUsageSection: PromptSection = {
  name: 'tools-usage',
  priority: 20,
  content: (ctx: PromptContext) => {
    if (ctx.tools.length === 0) return ''

    const toolList = ctx.tools.map(t =>
      `- **${t.name}**: ${t.description} (risk: ${t.riskLevel})`
    ).join('\n')

    return `## Available Tools

You have the following tools available. Use them to read files, search code, create documents, and perform actions.

${toolList}

### Tool Usage Rules
1. **Prefer tools over questions** — if a tool can answer a question, use it instead of asking the user.
2. **One logical action per tool call** — don't batch unrelated operations.
3. **Report tool results** — when a tool returns data, summarize the key findings for the user.
4. **Handle errors gracefully** — if a tool fails, explain what went wrong and try an alternative approach.
5. **Respect permissions** — some tools require user approval. Wait for confirmation before proceeding with risky actions.`
  },
  condition: (ctx: PromptContext) => ctx.tools.length > 0,
}
