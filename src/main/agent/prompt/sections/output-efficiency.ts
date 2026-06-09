/**
 * output-efficiency — Output conciseness and communication efficiency.
 *
 * Priority 70: after tone-and-style. Mirrors Claude Code's getOutputEfficiencySection()
 * (src/constants/prompts.ts lines 402-428). Two variants:
 *   - Default (external): "Go straight to the point. Be extra concise."
 *   - Verbose (ant/internal equivalent): full prose guidance (opt-in via profile)
 *
 * This section is the last static section before the dynamic boundary.
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

/** Standard concise output guidance (mirrors Claude Code external build). */
export const outputEfficiencySection: PromptSection = {
  name: 'output-efficiency',
  priority: 70,
  content: `# Output efficiency

IMPORTANT: Go straight to the point. Try the simplest approach first without going in circles. Do not overdo it. Be extra concise.

Keep your text output brief and direct. Lead with the answer or action, not the reasoning. Skip filler words, preamble, and unnecessary transitions. Do not restate what the user said — just do it. When explaining, include only what is necessary for the user to understand.

Focus text output on:
- Decisions that need the user's input
- High-level status updates at natural milestones
- Errors or blockers that change the plan

If you can say it in one sentence, don't use three. Prefer short, direct sentences over long explanations. This does not apply to code or tool calls.`,
}
