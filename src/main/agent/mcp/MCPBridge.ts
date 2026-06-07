/**
 * MCPBridge — adapts MCP-discovered tools, skills, and resources
 * into AttaSeek's ToolManifest, SkillManifest, and Artifact formats.
 */

import type { ToolManifest, ToolPermissionPolicy } from '../../../shared/types/Tool'
import type { SkillManifest } from '../../../shared/types/Skill'

const builtinPolicy: ToolPermissionPolicy = {
  default: 'allow',
  requirePreview: false,
  allowAlways: false,
}

/** Convert an MCP tool definition to an AttaSeek ToolManifest */
export function mcpToolToManifest(
  serverName: string,
  tool: { name: string; description?: string; inputSchema: Record<string, unknown> },
): ToolManifest {
  return {
    id: `mcp__${serverName}__${tool.name}`,
    pluginId: `mcp:${serverName}`,
    name: tool.name,
    description: tool.description || `MCP tool: ${tool.name} (${serverName})`,
    inputSchema: tool.inputSchema || { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    riskLevel: 'read',
    category: 'plugin',
    permissionPolicy: builtinPolicy,
    isReadOnly: true,
    isConcurrencySafe: true,
  }
}

/** Convert an MCP prompt definition to an AttaSeek SkillManifest */
export function mcpPromptToSkill(
  serverName: string,
  prompt: { name: string; description?: string; arguments?: Array<{ name: string; description?: string }> },
): SkillManifest {
  const props: Record<string, unknown> = {}
  const required: string[] = []
  if (prompt.arguments) {
    for (const arg of prompt.arguments) {
      props[arg.name] = { type: 'string', description: arg.description || '' }
      if ((arg as Record<string, unknown>).required) required.push(arg.name)
    }
  }

  return {
    id: `mcp__${serverName}__${prompt.name}`,
    pluginId: `mcp:${serverName}`,
    name: prompt.name,
    description: prompt.description || `MCP prompt: ${prompt.name}`,
    layer: 'atomic',
    inputSchema: { type: 'object', properties: props, required },
    outputSchema: { type: 'object', properties: {} },
    requiredTools: [],
    riskLevel: 'low',
    defaultPlan: '',
    verificationRules: [],
  }
}
