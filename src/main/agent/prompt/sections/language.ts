/**
 * language — Language preference enforcement.
 *
 * Priority 110: after env-info. Mirrors Claude Code's getLanguageSection()
 * (src/constants/prompts.ts lines 142-149). Only renders when a language
 * preference is set. Forces the model to respond in the specified language
 * while keeping technical terms in their original form.
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const languageSection: PromptSection = {
  name: 'language',
  priority: 110,
  content: (ctx: PromptContext) => {
    if (!ctx.languagePreference) return ''
    return `# Language
Always respond in ${ctx.languagePreference}. Use ${ctx.languagePreference} for all explanations, comments, and communications with the user. Technical terms and code identifiers should remain in their original form.`
  },
  condition: (ctx: PromptContext) => !!ctx.languagePreference,
}
