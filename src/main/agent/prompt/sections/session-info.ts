/**
 * session-info — Session metadata and loaded skills listing.
 *
 * Priority 40: after memory, before tone/style.
 */

import type { PromptSection, PromptContext } from '../PromptTemplate'

export const sessionInfoSection: PromptSection = {
  name: 'session-info',
  priority: 40,
  content: (ctx: PromptContext) => {
    const parts: string[] = []

    if (ctx.skills.length > 0) {
      const skillList = ctx.skills.map(s =>
        `- **${s.name}**: ${s.description}`
      ).join('\n')
      parts.push(`## Loaded Skills\n\n${skillList}`)
    }

    return parts.join('\n\n')
  },
  condition: (ctx: PromptContext) => ctx.skills.length > 0,
}
