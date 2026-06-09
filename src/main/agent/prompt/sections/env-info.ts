/**
 * env-info — Environment information injection.
 *
 * Priority 100: after session-guidance and memory. Mirrors Claude Code's
 * computeSimpleEnvInfo() (src/constants/prompts.ts lines 651-710). Injects:
 *   1. Working directory
 *   2. Git repository status
 *   3. Additional working directories
 *   4. Platform, shell, OS version
 *   5. Model identity (name, knowledge cutoff, family IDs)
 *   6. Shell syntax hint (Unix on macOS/Linux)
 *
 * This is a dynamic section — computed fresh each render with values from PromptContext.
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const envInfoSection: PromptSection = {
  name: 'env-info',
  priority: 100,
  content: (ctx: PromptContext) => {
    const items: string[] = []

    // Working directory
    if (ctx.cwd) {
      items.push(`Primary working directory: ${ctx.cwd}`)
    }

    // Git status
    if (ctx.isGit !== undefined) {
      items.push(`Is directory a git repo: ${ctx.isGit ? 'Yes' : 'No'}`)
    }

    // Additional working directories
    if (ctx.additionalWorkingDirs && ctx.additionalWorkingDirs.length > 0) {
      items.push(`Additional working directories: ${ctx.additionalWorkingDirs.join(', ')}`)
    }

    // Platform
    items.push(`Platform: ${ctx.platform}`)

    // Shell
    if (ctx.shell) {
      items.push(`Shell: ${ctx.shell}`)
    }

    // OS version
    if (ctx.osVersion) {
      items.push(`OS Version: ${ctx.osVersion}`)
    }

    // Model identity
    if (ctx.modelDescription) {
      items.push(ctx.modelDescription)
    }

    // Knowledge cutoff
    if (ctx.knowledgeCutoff) {
      items.push(`Assistant knowledge cutoff is ${ctx.knowledgeCutoff}.`)
    }

    // Model family info (only for Claude models)
    if (ctx.modelFamilyIds) {
      items.push(ctx.modelFamilyIds)
    }

    if (items.length === 0) return ''

    return `# Environment\nYou have been invoked in the following environment:\n${items.map(i => ` - ${i}`).join('\n')}`
  },
  condition: (ctx: PromptContext) => !!ctx.cwd || !!ctx.platform,
}
