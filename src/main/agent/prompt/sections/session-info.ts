/**
 * session-info — Loaded skills, session metadata, and constraints.
 *
 * Priority 40: after memory. Lists loaded skills and any
 * project-level constraints. Rendered only when skills are active.
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const sessionInfoSection: PromptSection = {
  name: 'session-info',
  priority: 75,
  content: (ctx: PromptContext) => {
    const parts: string[] = []

    // Loaded skills (from .claude/skills/)
    if (ctx.skills.length > 0) {
      const skillList = ctx.skills.map(s => {
        let entry = `- **${s.name}**: ${s.description}`
        if (s.defaultPlan) entry += `\n  Default plan: ${s.defaultPlan}`
        if (s.verificationRules?.length) {
          entry += `\n  Verification: ${s.verificationRules.join(', ')}`
        }
        return entry
      }).join('\n')
      parts.push(`## Loaded Skills\n\n${skillList}`)
    }

    // Goal reminder (keeps the agent focused)
    const goalPreview = ctx.goal.length > 100
      ? ctx.goal.slice(0, 100) + '...'
      : ctx.goal
    parts.push(`## Current Goal\n\n${goalPreview}`)

    return parts.join('\n\n')
  },
  condition: (ctx: PromptContext) => ctx.skills.length > 0 || ctx.goal.length > 0,
}
