/**
 * MCPServerManager — MCP server lifecycle management with real connectivity.
 *
 * Boot sequence:
 *   1. Load configs from .claude/mcp.json (user + project)
 *   2. Create transport (stdio) + MCPClient per server
 *   3. Connect and initialize MCP session
 *   4. Discover tools → register via MCPBridge → toolRegistry
 *   5. Discover prompts → register via MCPBridge → skillRegistry
 *
 * Crash recovery: auto-restart up to 3 times with exponential backoff.
 */

import { toolRegistry } from '../../tools/ToolRegistry'
import { skillRegistry } from '../../skills/SkillRegistry'
import { createTransport, type MCPTransport } from './MCPTransport'
import { MCPClient } from './MCPClient'
import { loadMCPConfigs, type MCPServerConfig } from './MCPConfigLoader'
import { mcpToolToManifest, mcpPromptToSkill } from './MCPBridge'

export type MCPServerStatus = 'starting' | 'healthy' | 'unhealthy' | 'stopped'

export interface MCPServerState {
  id: string
  status: MCPServerStatus
  transport: MCPTransport
  client: MCPClient
  crashCount: number
  lastError?: string
  startedAt?: number
}

export class MCPServerManager {
  private servers = new Map<string, MCPServerState>()
  private maxRestarts = 3

  /** Boot all configured MCP servers. Called from boot.ts. */
  async boot(workspaceRoot?: string): Promise<{ connected: string[]; failed: string[] }> {
    const configs = loadMCPConfigs(workspaceRoot)
    const connected: string[] = []
    const failed: string[] = []

    for (const config of configs) {
      try {
        await this.startServer(config)
        connected.push(config.id)
      } catch (err) {
        failed.push(config.id)
        console.warn(`[MCP] boot: server "${config.id}" failed:`, err instanceof Error ? err.message : 'Unknown')
      }
    }

    console.log(`[MCP] boot complete: ${connected.length} connected, ${failed.length} failed`)
    return { connected, failed }
  }

  /** Start a single MCP server */
  async startServer(config: MCPServerConfig): Promise<void> {
    const transport = createTransport(config.transport)
    const client = new MCPClient(config.id, transport)

    const state: MCPServerState = {
      id: config.id,
      status: 'starting',
      transport,
      client,
      crashCount: 0,
      startedAt: Date.now(),
    }
    this.servers.set(config.id, state)

    try {
      await client.connect()
      state.status = 'healthy'

      // Discover and register tools
      try {
        const tools = await client.listTools()
        for (const tool of tools) {
          const manifest = mcpToolToManifest(config.id, tool)
          toolRegistry.register(manifest)
        }
        if (tools.length > 0) {
          console.log(`[MCP:${config.id}] registered ${tools.length} tools`)
        }
      } catch (err) {
        console.warn(`[MCP:${config.id}] tool discovery failed:`, err)
      }

      // Discover and register prompts as skills
      try {
        const prompts = await client.listPrompts()
        for (const prompt of prompts) {
          const skill = mcpPromptToSkill(config.id, prompt)
          skillRegistry.register(skill)
        }
        if (prompts.length > 0) {
          console.log(`[MCP:${config.id}] registered ${prompts.length} skills`)
        }
      } catch (err) {
        console.warn(`[MCP:${config.id}] prompt discovery failed:`, err)
      }
    } catch (err) {
      await this.handleCrash(config.id, err instanceof Error ? err.message : 'Unknown')
    }
  }

  /** Stop an MCP server and unregister its tools/skills */
  async stopServer(id: string): Promise<void> {
    const state = this.servers.get(id)
    if (!state) return

    // Unregister tools and skills
    toolRegistry.unregisterByPlugin(`mcp:${id}`)
    skillRegistry.unregisterByPlugin(`mcp:${id}`)

    await state.client.disconnect()
    state.status = 'stopped'
    this.servers.delete(id)
    console.log(`[MCP:${id}] stopped`)
  }

  /** Restart a server */
  async restartServer(id: string): Promise<void> {
    const state = this.servers.get(id)
    if (!state) return
    const config = loadMCPConfigs().find(c => c.id === id)
    if (!config) return
    await this.stopServer(id)
    await this.startServer(config)
  }

  getStatus(id: string): MCPServerState | undefined {
    return this.servers.get(id)
  }

  listServers(): MCPServerState[] {
    return Array.from(this.servers.values())
  }

  async healthCheck(id: string): Promise<boolean> {
    const state = this.servers.get(id)
    if (!state || state.status !== 'healthy') return false
    return state.client.isConnected
  }

  /** Shutdown all servers */
  async shutdown(): Promise<void> {
    for (const [id] of this.servers) {
      await this.stopServer(id)
    }
  }

  private async handleCrash(id: string, error: string): Promise<void> {
    const state = this.servers.get(id)
    if (!state) return
    state.crashCount++
    state.lastError = error

    if (state.crashCount <= this.maxRestarts) {
      const delay = Math.min(1000 * Math.pow(2, state.crashCount - 1), 10000)
      console.warn(`[MCP:${id}] crashed (attempt ${state.crashCount}/${this.maxRestarts}), restarting in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
      await this.startServer({ id, transport: state.transport.type === 'stdio'
        ? { type: 'stdio', command: (state.transport as unknown as { config: Record<string, unknown> }).config?.command as string }
        : { type: 'sse', url: '' }, enabled: true })
    } else {
      state.status = 'unhealthy'
      console.error(`[MCP:${id}] failed after ${this.maxRestarts} restarts: ${error}`)
    }
  }
}

export const mcpServerManager = new MCPServerManager()
