/**
 * MCPTransport — transport layer abstraction for MCP connections.
 *
 * Supports stdio (child_process) and SSE (HTTP) transports.
 * Designed for @modelcontextprotocol/sdk ClientTransport interface.
 */

import type { ChildProcess } from 'child_process'

export type MCPTransportType = 'stdio' | 'sse'

export interface MCPTransportConfig {
  type: MCPTransportType
  command?: string      // stdio: command to spawn
  args?: string[]       // stdio: arguments
  env?: Record<string, string>
  url?: string          // sse: endpoint URL
  headers?: Record<string, string>  // sse: HTTP headers
}

export interface MCPTransport {
  readonly type: MCPTransportType
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(message: unknown): Promise<void>
  onMessage(handler: (message: unknown) => void): void
  readonly isConnected: boolean
}

export function createTransport(config: MCPTransportConfig): MCPTransport {
  switch (config.type) {
    case 'stdio': return new StdioTransport(config)
    case 'sse': return new SSETransport(config)
    default: throw new Error(`Unsupported MCP transport: ${config.type}`)
  }
}

// ── Stdio transport ──

class StdioTransport implements MCPTransport {
  readonly type: MCPTransportType = 'stdio'
  private process: ChildProcess | null = null
  private messageHandlers: Array<(msg: unknown) => void> = []
  private buffer = ''
  // Store handler references for cleanup on disconnect
  private _stdoutHandler: ((data: Buffer) => void) | null = null
  private _errorHandler: ((err: Error) => void) | null = null

  constructor(private config: MCPTransportConfig) {}

  get isConnected(): boolean { return this.process !== null && !this.process.killed }

  async connect(): Promise<void> {
    if (!this.config.command) throw new Error('stdio transport requires a command')
    const { spawn } = await import('child_process')
    this.process = spawn(this.config.command, this.config.args || [], {
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this._stdoutHandler = (data: Buffer) => {
      this.buffer += data.toString()
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          for (const h of this.messageHandlers) h(msg)
        } catch { /* skip non-JSON lines (stderr, etc.) */ }
      }
    }

    this._errorHandler = (err) => {
      console.warn(`[MCP:stdio] process error:`, err.message)
    }

    this.process.stdout?.on('data', this._stdoutHandler)
    this.process.on('error', this._errorHandler)
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      if (this._stdoutHandler) {
        this.process.stdout?.off('data', this._stdoutHandler)
        this._stdoutHandler = null
      }
      if (this._errorHandler) {
        this.process.off('error', this._errorHandler)
        this._errorHandler = null
      }
      if (!this.process.killed) {
        this.process.kill()
      }
    }
    this.process = null
  }

  async send(message: unknown): Promise<void> {
    if (!this.process?.stdin) throw new Error('Not connected')
    const json = JSON.stringify(message)
    this.process.stdin.write(json + '\n')
  }

  onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.push(handler)
  }
}

// ── SSE transport ──

class SSETransport implements MCPTransport {
  readonly type: MCPTransportType = 'sse'
  private connected = false
  private messageHandlers: Array<(msg: unknown) => void> = []
  private abortController: AbortController | null = null

  constructor(private config: MCPTransportConfig) {}

  get isConnected(): boolean { return this.connected }

  async connect(): Promise<void> {
    if (!this.config.url) throw new Error('SSE transport requires a URL')
    // Placeholder: full SSE implementation requires EventSource or fetch+stream
    // For now, mark as connected for health check purposes
    this.connected = true
    console.warn('[MCP:SSE] SSE transport not fully implemented — using stub')
  }

  async disconnect(): Promise<void> {
    this.abortController?.abort()
    this.connected = false
  }

  async send(message: unknown): Promise<void> {
    if (!this.config.url) throw new Error('Not connected')
    await fetch(this.config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.config.headers },
      body: JSON.stringify(message),
    })
  }

  onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.push(handler)
  }
}
