/**
 * MCPConfigLoader — loads MCP server configurations from .claude/mcp.json.
 *
 * Config files (priority order):
 *   1. Project: .claude/mcp.json (workspace root)
 *   2. User: ~/.claude/mcp.json
 *
 * Format:
 *   {
 *     "mcpServers": {
 *       "server-name": {
 *         "transport": "stdio",
 *         "command": "npx",
 *         "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
 *         "env": {}
 *       }
 *     }
 *   }
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { MCPTransportConfig } from './MCPTransport'

export interface MCPServerConfig {
  id: string
  transport: MCPTransportConfig
  enabled: boolean
}

/** Load MCP server configs from all sources */
export function loadMCPConfigs(workspaceRoot?: string): MCPServerConfig[] {
  const configs: MCPServerConfig[] = []

  // User config: ~/.claude/mcp.json
  const userPath = path.join(os.homedir(), '.claude', 'mcp.json')
  configs.push(...loadFromFile(userPath, 'user'))

  // Project config: .claude/mcp.json
  if (workspaceRoot) {
    const projectPath = path.join(workspaceRoot, '.claude', 'mcp.json')
    configs.push(...loadFromFile(projectPath, 'project'))
  }

  // Dedup: project overrides user for same server ID
  const deduped = new Map<string, MCPServerConfig>()
  for (const c of configs) {
    deduped.set(c.id, c) // Later entries override earlier ones
  }

  return Array.from(deduped.values()).filter(c => c.enabled)
}

function loadFromFile(filePath: string, source: string): MCPServerConfig[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(content) as { mcpServers?: Record<string, Record<string, unknown>> }
    if (!json.mcpServers) return []

    return Object.entries(json.mcpServers).map(([id, cfg]) => ({
      id: `${source}:${id}`,
      transport: parseTransportConfig(cfg),
      enabled: cfg.enabled !== false,
    }))
  } catch {
    return [] // best-effort: file doesn't exist or is invalid — skip
  }
}

function parseTransportConfig(raw: Record<string, unknown>): MCPTransportConfig {
  const type = (raw.transport as string) || 'stdio'
  return {
    type: type as 'stdio' | 'sse',
    command: raw.command as string | undefined,
    args: raw.args as string[] | undefined,
    env: raw.env as Record<string, string> | undefined,
    url: raw.url as string | undefined,
    headers: raw.headers as Record<string, string> | undefined,
  }
}
