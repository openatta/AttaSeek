/**
 * using-tools — Tool availability, usage patterns, and safety rules.
 *
 * Priority 50: after actions. Mirrors Claude Code's getUsingYourToolsSection()
 * (src/constants/prompts.ts lines 269-314). Lists available tools grouped by
 * purpose, gives explicit "prefer dedicated tools over Bash" guidance,
 * and explains parallel vs sequential tool call strategy.
 *
 * This replaces the legacy tools-usage.ts which grouped tools by risk level.
 * The new format matches Claude Code: tool-name-specific substitution rules
 * (FileRead > cat/head/tail, FileEdit > sed/awk, etc.) plus task management
 * and parallelism guidance.
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const usingToolsSection: PromptSection = {
  name: 'using-tools',
  priority: 50,
  content: (ctx: PromptContext) => {
    if (ctx.tools.length === 0) return ''

    const toolNames = new Set(ctx.tools.map(t => t.name))
    const hasBash = toolNames.has('bash') || toolNames.has('execute_command')

    // Map AttaSeek tool names to guidance text
    const readTool = toolNames.has('read_file') ? 'read_file'
      : toolNames.has('FileRead') ? 'FileRead' : null
    const editTool = toolNames.has('edit_file') ? 'edit_file'
      : toolNames.has('FileEdit') ? 'FileEdit' : null
    const writeTool = toolNames.has('write_file') ? 'write_file'
      : toolNames.has('FileWrite') ? 'FileWrite' : null
    const globTool = toolNames.has('glob') ? 'glob'
      : toolNames.has('Glob') ? 'Glob' : null
    const grepTool = toolNames.has('grep') ? 'grep'
      : toolNames.has('Grep') ? 'Grep' : null
    const taskTool = toolNames.has('task_create') ? 'task_create'
      : toolNames.has('TaskCreate') ? 'TaskCreate'
      : toolNames.has('todo_write') ? 'todo_write' : null
    const agentTool = toolNames.has('spawn_agent') ? 'spawn_agent'
      : toolNames.has('Agent') ? 'Agent' : null
    const bashTool = toolNames.has('bash') ? 'bash'
      : toolNames.has('Bash') ? 'Bash' : 'Bash'

    // Tool-specific substitution rules
    const toolSubstitutions: string[] = []
    if (readTool) toolSubstitutions.push(`To read files use ${readTool} instead of cat, head, tail, or sed`)
    if (editTool) toolSubstitutions.push(`To edit files use ${editTool} instead of sed or awk`)
    if (writeTool) toolSubstitutions.push(`To create files use ${writeTool} instead of cat with heredoc or echo redirection`)
    if (globTool) toolSubstitutions.push(`To search for files use ${globTool} instead of find or ls`)
    if (grepTool) toolSubstitutions.push(`To search the content of files, use ${grepTool} instead of grep or rg`)
    if (hasBash) {
      toolSubstitutions.push(`Reserve using the ${bashTool} exclusively for system commands and terminal operations that require shell execution. If you are unsure and there is a relevant dedicated tool, default to using the dedicated tool and only fallback on using the ${bashTool} tool for these if it is absolutely necessary.`)
    }

    const parts: string[] = ['# Using your tools']

    // Primary tool guidance
    if (toolSubstitutions.length > 0) {
      parts.push(`Do NOT use the ${bashTool} to run commands when a relevant dedicated tool is provided. Using dedicated tools allows the user to better understand and review your work. This is CRITICAL to assisting the user:`)
      parts.push(toolSubstitutions.map(s => `  - ${s}`).join('\n'))
    }

    // Task management
    if (taskTool) {
      parts.push(`Break down and manage your work with the ${taskTool} tool. These tools are helpful for planning your work and helping the user track your progress. Mark each task as completed as soon as you are done with the task. Do not batch up multiple tasks before marking them as completed.`)
    }

    // Parallelism
    parts.push(`You can call multiple tools in a single response. If you intend to call multiple tools and there are no dependencies between them, make all independent tool calls in parallel. Maximize use of parallel tool calls where possible to increase efficiency. However, if some tool calls depend on previous calls to inform dependent values, do NOT call these tools in parallel and instead call them sequentially. For instance, if one operation must complete before another starts, run these operations sequentially instead.`)

    return parts.join('\n\n')
  },
  condition: (ctx: PromptContext) => ctx.tools.length > 0,
}
