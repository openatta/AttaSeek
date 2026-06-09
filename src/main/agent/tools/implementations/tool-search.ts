/**
 * ToolSearchTool — on-demand MCP / deferred tool discovery.
 *
 * When enabled, MCP tools are sent with defer_loading: true instead of
 * full inline definitions. The model discovers them via this tool,
 * which returns matching tool definitions. This keeps context window
 * from being consumed by rarely-used MCP tools.
 *
 * Mirrors Claude Code's ToolSearchTool (src/tools/ToolSearchTool/).
 */

import type { ToolManifest } from '../../../../shared/types/Tool'
import type { ToolExecResult } from '../ToolOrchestrator'
import { toolRegistry } from '../../../tools/ToolRegistry'

// ── Constants ──

export const TOOL_SEARCH_TOOL_NAME = 'ToolSearch'

/** Maximum number of results per search query. */
const MAX_RESULTS = 20

// ── Tool manifest ──

export const toolSearchManifest: ToolManifest = {
  name: TOOL_SEARCH_TOOL_NAME,
  description:
    'Search for available tools by name or description. Use this to discover ' +
    'tools that are not listed in your default tool set (MCP tools, dynamic tools). ' +
    'Returns matching tool names, descriptions, and input schemas.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query — tool name fragment or description keyword.',
      },
    },
    required: ['query'],
  },
  riskLevel: 'read',
  isConcurrencySafe: true,
}

// ── Implementation ──

export async function toolSearchImpl(
  input: { query: string },
): Promise<ToolExecResult> {
  const query = (input.query || '').toLowerCase().trim()

  if (!query) {
    return {
      toolCallId: '',
      toolUse: { type: 'tool_use', name: TOOL_SEARCH_TOOL_NAME, id: '', input },
      success: true,
      output: { tools: [], totalCount: 0, hint: 'Provide a search query to find tools.' },
    }
  }

  // Search all registered tools by name and description
  const allTools = toolRegistry.list()
  const matches = allTools
    .filter((t) => {
      if (t.name === TOOL_SEARCH_TOOL_NAME) return false // Don't return self
      const nameMatch = t.name.toLowerCase().includes(query)
      const descMatch = t.description?.toLowerCase().includes(query)
      return nameMatch || descMatch
    })
    .slice(0, MAX_RESULTS)
    .map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
      isDeferred: t.isDeferred === true,
    }))

  return {
    toolCallId: '',
    toolUse: { type: 'tool_use', name: TOOL_SEARCH_TOOL_NAME, id: '', input },
    success: true,
    output: {
      tools: matches,
      totalCount: matches.length,
      hint: matches.length >= MAX_RESULTS
        ? `Showing ${MAX_RESULTS} of many matches. Refine your query for more specific results.`
        : `Found ${matches.length} matching tool(s).`,
    },
  }
}
