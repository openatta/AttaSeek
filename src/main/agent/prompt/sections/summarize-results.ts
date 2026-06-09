/**
 * summarize-results — Reminder to save important information before tool results
 * are cleared by automatic context compression.
 *
 * Priority 160: after FRC section. Mirrors Claude Code's
 * SUMMARIZE_TOOL_RESULTS_SECTION constant.
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const summarizeResultsSection: PromptSection = {
  name: 'summarize-results',
  priority: 160,
  content: `When working with tool results, write down any important information you might need later in your response, as the original tool result may be cleared later.`,
}
