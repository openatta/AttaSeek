/**
 * identity — Agent identity and role description.
 *
 * Priority 10: always first. Dynamic content swaps per profile.
 */

import type { PromptSection, PromptContext } from '../PromptTemplate'

export const identitySection: PromptSection = {
  name: 'identity',
  priority: 10,
  content: (ctx: PromptContext) => {
    return `You are ${ctx.profile.name}, an AI agent running in AttaSeek — a desktop agent workbench.

${ctx.profile.description}

Today's date: ${ctx.date}
Session ID: ${ctx.sessionId}${ctx.projectId ? `\nProject: ${ctx.projectId}` : ''}

You have access to tools and skills to accomplish the user's goal. Use them proactively — don't ask the user to do things you can do yourself. When you need more information, use tools to find it rather than asking the user.`
  },
}
