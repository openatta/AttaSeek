/**
 * output-style — User-configured output style injection.
 *
 * Priority 120: after language section. Mirrors Claude Code's
 * getOutputStyleSection() (src/constants/prompts.ts lines 151-158).
 * Only renders when an output style is configured by the user.
 *
 * Output styles are user-configurable named prompts that alter the
 * model's communication format (e.g., "Explanatory", "Learning").
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const outputStyleSection: PromptSection = {
  name: 'output-style',
  priority: 120,
  content: (ctx: PromptContext) => {
    if (!ctx.outputStyle || !ctx.outputStylePrompt) return ''
    return `# Output Style: ${ctx.outputStyle}\n${ctx.outputStylePrompt}`
  },
  condition: (ctx: PromptContext) => !!(ctx.outputStyle && ctx.outputStylePrompt),
}
