/**
 * scratchpad — Temporary file directory guidance.
 *
 * Priority 140: after any conditionally-rendered sections. Mirrors Claude Code's
 * getScratchpadInstructions() (src/constants/prompts.ts lines 797-819).
 * Only renders when scratchpad is enabled. Instructs the model to use a
 * dedicated per-session directory instead of /tmp for temporary files.
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const scratchpadSection: PromptSection = {
  name: 'scratchpad',
  priority: 140,
  content: (ctx: PromptContext) => {
    if (!ctx.scratchpadDir) return ''
    return `# Scratchpad Directory

IMPORTANT: Always use this scratchpad directory for temporary files instead of \`/tmp\` or other system temp directories:
\`${ctx.scratchpadDir}\`

Use this directory for ALL temporary file needs:
- Storing intermediate results or data during multi-step tasks
- Writing temporary scripts or configuration files
- Saving outputs that don't belong in the user's project
- Creating working files during analysis or processing
- Any file that would otherwise go to \`/tmp\`

Only use \`/tmp\` if the user explicitly requests it.

The scratchpad directory is session-specific, isolated from the user's project, and can be used freely without permission prompts.`
  },
  condition: (ctx: PromptContext) => !!ctx.scratchpadDir,
}
