/**
 * session-guidance — Session-specific tool usage guidance.
 *
 * Priority 80: first dynamic section after the static/dynamic boundary.
 * Mirrors Claude Code's getSessionSpecificGuidanceSection()
 * (src/constants/prompts.ts lines 352-400). Conditionally includes:
 *   1. AskUserQuestion guidance (when denied by user)
 *   2. Shell shortcut (! prefix for user to run commands)
 *   3. Agent tool guidance (fork vs subagent, explore agent)
 *   4. Skill invocation guidance (/skill-name → SkillTool)
 *   5. Sub-agent verification contract (if verification agent configured)
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const sessionGuidanceSection: PromptSection = {
  name: 'session-guidance',
  priority: 80,
  content: (ctx: PromptContext) => {
    const toolNames = new Set(ctx.tools.map(t => t.name))
    const hasAskUserQuestion = toolNames.has('ask_user_question') || toolNames.has('AskUserQuestion')
    const hasAgentTool = toolNames.has('spawn_agent') || toolNames.has('Agent')
    const hasSkillTool = toolNames.has('skill') || toolNames.has('Skill')
    const hasGlob = toolNames.has('glob') || toolNames.has('Glob')
    const hasGrep = toolNames.has('grep') || toolNames.has('Grep')
    const hasBash = toolNames.has('bash') || toolNames.has('Bash')

    const items: string[] = []

    // AskUserQuestion guidance
    if (hasAskUserQuestion) {
      items.push(`If you do not understand why the user has denied a tool call, use the AskUserQuestion tool to ask them.`)
    }

    // Shell shortcut for user
    items.push(`If you need the user to run a shell command themselves (e.g., an interactive login like \`gcloud auth login\`), suggest they type \`! <command>\` in the prompt — the \`!\` prefix runs the command in this session so its output lands directly in the conversation.`)

    // Agent tool guidance
    if (hasAgentTool) {
      items.push(`Use the spawn_agent tool with specialized agents when the task at hand matches the agent's description. Subagents are valuable for parallelizing independent queries or for protecting the main context window from excessive results, but they should not be used excessively when not needed. Importantly, avoid duplicating work that subagents are already doing - if you delegate research to a subagent, do not also perform the same searches yourself.`)

      // Explore agent guidance
      const searchTools = (hasGlob || hasGrep)
        ? `the ${[hasGlob && 'glob', hasGrep && 'grep'].filter(Boolean).join(' or ')} tool`
        : hasBash ? `\`find\` or \`grep\` via the bash tool` : 'search tools'
      items.push(`For simple, directed codebase searches (e.g. for a specific file/class/function) use ${searchTools} directly. For broader codebase exploration and deep research, use the spawn_agent tool with agent_type="Explore". This is slower than using search tools directly, so use this only when a simple, directed search proves to be insufficient or when your task will clearly require more extensive exploration.`)
    }

    // Skill guidance
    if (hasSkillTool && ctx.skills.length > 0) {
      const userSkills = ctx.skills.filter(s => (s as any).userInvocable !== false)
      if (userSkills.length > 0) {
        const skillNames = userSkills.map(s => s.name).join(', ')
        items.push(`/<skill-name> (e.g., /${userSkills[0]?.name || 'help'}) is shorthand for users to invoke a user-invocable skill. When executed, the skill gets expanded to a full prompt. Use the Skill tool to execute them. IMPORTANT: Only use Skill for skills listed in its user-invocable skills section [${skillNames}] - do not guess or use built-in CLI commands.`)
      }
    }

    if (items.length === 0) return ''

    return `# Session-specific guidance\n${items.map(i => ` - ${i}`).join('\n')}`
  },
  condition: (ctx: PromptContext) => ctx.tools.length > 0,
}
