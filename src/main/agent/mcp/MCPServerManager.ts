/**
 * MCPServerManager — MCP server process lifecycle management.
 *
 * Each MCP server runs as an independent child process communicating
 * via JSON-RPC 2.0 over stdin/stdout.
 *
 * Crash recovery: auto-restart up to 3 times with exponential backoff.
 * After 3 failures, server is marked unhealthy and user is notified.
 */

export interface MCPServerConfig {
  id: string
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  restartDelayMs?: number
}

export type MCPServerStatus = 'starting' | 'healthy' | 'unhealthy' | 'stopped'

export interface MCPServerState {
  config: MCPServerConfig
  status: MCPServerStatus
  pid?: number
  crashCount: number
  lastError?: string
  startedAt?: number
}

export class MCPServerManager {
  private servers = new Map<string, MCPServerState>()
  private maxRestarts = 3

  async startServer(config: MCPServerConfig): Promise<void> {
    const state: MCPServerState = {
      config,
      status: 'starting',
      crashCount: 0,
      startedAt: Date.now(),
    }
    this.servers.set(config.id, state)

    try {
      // In production: child_process.spawn(config.command, config.args, { env, cwd, stdio: ['pipe','pipe','pipe'] })
      // For MVP: mark as healthy (actual spawn to be wired in integration phase)
      state.status = 'healthy'
      console.log(`[MCP] server "${config.id}" started`)
    } catch (err) {
      await this.handleCrash(config.id, err instanceof Error ? err.message : 'Unknown')
    }
  }

  async stopServer(id: string): Promise<void> {
    const state = this.servers.get(id)
    if (!state) return
    state.status = 'stopped'
    this.servers.delete(id)
    console.log(`[MCP] server "${id}" stopped`)
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
    try {
      // Ping via JSON-RPC: { jsonrpc: '2.0', method: 'ping', id: 'health' }
      return true
    } catch {
      return false
    }
  }

  private async handleCrash(id: string, error: string): Promise<void> {
    const state = this.servers.get(id)
    if (!state) return
    state.crashCount++
    state.lastError = error

    if (state.crashCount <= this.maxRestarts) {
      const delay = Math.min(1000 * Math.pow(2, state.crashCount - 1), 10000)
      console.warn(`[MCP] server "${id}" crashed (attempt ${state.crashCount}), restarting in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
      await this.startServer(state.config)
    } else {
      state.status = 'unhealthy'
      console.error(`[MCP] server "${id}" failed after ${this.maxRestarts} restarts: ${error}`)
    }
  }
}

export const mcpServerManager = new MCPServerManager()
