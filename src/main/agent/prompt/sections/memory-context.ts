/**
 * memory-context — Injects recalled memories and compact summary into system prompt.
 *
 * Priority 30: after tools, before session info.
 */

import type { PromptSection, PromptContext } from '../PromptTemplate'

export const memoryContextSection: PromptSection = {
  name: 'memory-context',
  priority: 30,
  content: (ctx: PromptContext) => {
    const parts: string[] = []

    if (ctx.memories.length > 0) {
      const memList = ctx.memories.map(m =>
        `- [${m.type}] ${m.content.slice(0, 500)}`
      ).join('\n')
      parts.push(`## Relevant Memories\n\n${memList}`)
    }

    if (ctx.compactSummary) {
      parts.push(`## Previous Conversation Summary\n\n${ctx.compactSummary}`)
    }

    return parts.join('\n\n')
  },
  condition: (ctx: PromptContext) => ctx.memories.length > 0 || !!ctx.compactSummary,
}
