/**
 * MCPTransport — transport layer abstraction for MCP connections.
 *
 * Supports four transport types:
 *   - stdio: child_process (fully implemented)
 *   - sse: Server-Sent Events / HTTP polling (stub)
 *   - http: HTTP JSON-RPC (POST-based)
 *   - ws: WebSocket (bidirectional, Node.js only)
 *
 * Designed for @modelcontextprotocol/sdk ClientTransport interface.
 *
 * Phase D: Added HttpTransport + WSTransport.
 */

import type { ChildProcess } from 'child_process'

export type MCPTransportType = 'stdio' | 'sse' | 'http' | 'ws'

export interface MCPTransportConfig {
  type: MCPTransportType
  command?: string      // stdio: command to spawn
  args?: string[]       // stdio: arguments
  env?: Record<string, string>
  url?: string          // sse/http/ws: endpoint URL
  headers?: Record<string, string>  // HTTP headers
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
    case 'http': return new HttpTransport(config)
    case 'ws': return new WSTransport(config)
    default: throw new Error(`Unsupported MCP transport: ${config.type}`)
  }
}

// ── Stdio transport ──

class StdioTransport implements MCPTransport {
  readonly type: MCPTransportType = 'stdio'
  private process: ChildProcess | null = null
  private messageHandlers: Array<(msg: unknown) => void> = []
  private buffer = ''
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
      if (this._stdoutHandler) { this.process.stdout?.off('data', this._stdoutHandler); this._stdoutHandler = null }
      if (this._errorHandler) { this.process.off('error', this._errorHandler); this._errorHandler = null }
      if (!this.process.killed) { this.process.kill() }
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

// ── HTTP transport (Phase D) ──

class HttpTransport implements MCPTransport {
  readonly type: MCPTransportType = 'http'
  private connected = false
  private messageHandlers: Array<(msg: unknown) => void> = []

  constructor(private config: MCPTransportConfig) {}

  get isConnected(): boolean { return this.connected }

  async connect(): Promise<void> {
    if (!this.config.url) throw new Error('HTTP transport requires a URL')
    try {
      const resp = await fetch(this.config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.config.headers },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 0 }),
        signal: AbortSignal.timeout(5000),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    } catch (err) {
      throw new Error(`MCP HTTP transport failed: ${(err as Error).message}`)
    }
    this.connected = true
  }

  async disconnect(): Promise<void> { this.connected = false }

  async send(message: unknown): Promise<void> {
    if (!this.config.url) throw new Error('Not connected')
    const resp = await fetch(this.config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.config.headers },
      body: JSON.stringify(message),
    })
    if (!resp.ok) throw new Error(`HTTP error: ${resp.status}`)
    try {
      const data = await resp.json()
      for (const h of this.messageHandlers) h(data)
    } catch { /* no JSON response body */ }
  }

  onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.push(handler)
  }
}

// ── WebSocket transport (Phase D) ──

class WSTransport implements MCPTransport {
  readonly type: MCPTransportType = 'ws'
  private ws: any = null
  private connected = false
  private messageHandlers: Array<(msg: unknown) => void> = []
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelays = [1000, 2000, 4000, 8000, 16000]
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private config: MCPTransportConfig) {}

  get isConnected(): boolean { return this.connected && this.ws !== null }

  async connect(): Promise<void> {
    if (!this.config.url) throw new Error('WS transport requires a URL')
    return new Promise((resolve, reject) => {
      try {
        // Dynamic require to avoid compile-time dependency on 'ws'
        const wsModule: any = require('ws')
        const WebSocket = wsModule.default || wsModule.WebSocket || wsModule
        const ws = new WebSocket(this.config.url!, { headers: this.config.headers })
        const timeout = setTimeout(() => { ws.close(); reject(new Error('WS connection timeout')) }, 10_000)

        ws.on('open', () => {
          clearTimeout(timeout)
          this.ws = ws; this.connected = true; this.reconnectAttempts = 0
          resolve()
        })

        ws.on('message', (data: Buffer | string) => {
          try {
            const msg = JSON.parse(data.toString())
            for (const h of this.messageHandlers) h(msg)
          } catch { /* skip non-JSON */ }
        })

        ws.on('close', () => { this.connected = false; this.attemptReconnect() })

        ws.on('error', (err: Error) => {
          clearTimeout(timeout)
          if (!this.connected) reject(err)
          else console.warn(`[MCP:WS] error:`, err.message)
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`[MCP:WS] max reconnect attempts reached`)
      return
    }
    const delay = this.reconnectDelays[this.reconnectAttempts] ?? 16000
    this.reconnectAttempts++
    console.warn(`[MCP:WS] reconnecting in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    this.reconnectTimer = setTimeout(() => { this.connect().catch(() => {}) }, delay)
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    if (this.ws) { this.ws.close(); this.ws = null }
    this.connected = false
  }

  async send(message: unknown): Promise<void> {
    if (!this.ws || !this.connected) throw new Error('Not connected')
    this.ws.send(JSON.stringify(message))
  }

  onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.push(handler)
  }
}
