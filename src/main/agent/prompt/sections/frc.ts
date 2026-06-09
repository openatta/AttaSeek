/**
 * frc — Function Result Clearing notification.
 *
 * Priority 155: after token-budget, before summarize-results. Mirrors
 * Claude Code's getFunctionResultClearingSection() (feature: CACHED_MICROCOMPACT).
 * Tells the model that old tool results will be automatically cleared from
 * context, so it should write down important information in its response.
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const frcSection: PromptSection = {
  name: 'frc',
  priority: 155,
  content: `# Function Result Clearing

Old tool results will be automatically cleared from context to free up space. The most recent results are always kept. When working with tool results, write down any important information you might need later in your response, as the original tool result may be cleared later.`,
}
