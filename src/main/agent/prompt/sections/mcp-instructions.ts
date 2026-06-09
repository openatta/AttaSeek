/**
 * mcp-instructions — MCP server provided instructions.
 *
 * Priority 130: after language section. Mirrors Claude Code's
 * getMcpInstructionsSection() (src/constants/prompts.ts lines 160-165).
 * Injects instructions from connected MCP servers into the system prompt.
 *
 * This is a dynamic section — recomputes when MCP servers connect/disconnect.
 * Instructions are collected from MCPServerManager.getConnectedInstructions()
 * and injected as named sub-sections.
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const mcpInstructionsSection: PromptSection = {
  name: 'mcp-instructions',
  priority: 130,
  content: (ctx: PromptContext) => {
    if (!ctx.mcpInstructions || ctx.mcpInstructions.length === 0) return ''

    const blocks = ctx.mcpInstructions
      .map(si => `## ${si.serverName}\n${si.instructions}`)
      .join('\n\n')

    return `# MCP Server Instructions

The following MCP servers have provided instructions for how to use their tools and resources:

${blocks}`
  },
  condition: (ctx: PromptContext) => !!(ctx.mcpInstructions && ctx.mcpInstructions.length > 0),
}
