/**
 * MCPClient — wraps @modelcontextprotocol/sdk Client for tool/resource/prompt discovery.
 *
 * Connects via a transport (stdio/sse), initializes the MCP session,
 * and exposes listTools/listResources/listPrompts for bridge adapters.
 */

import type { MCPTransport } from './MCPTransport'

// MCP JSON-RPC message types (lightweight — full SDK types optional)
interface MCPToolDef {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

interface MCPResourceDef {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

interface MCPPromptDef {
  name: string
  description?: string
  arguments?: Array<{ name: string; description?: string; required?: boolean }>
}

export class MCPClient {
  private transport: MCPTransport
  private connected = false
  private serverName: string

  constructor(serverName: string, transport: MCPTransport) {
    this.serverName = serverName
    this.transport = transport
  }

  async connect(): Promise<void> {
    await this.transport.connect()
    // Initialize MCP session
    const initResult = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {}, resources: {}, prompts: {} },
      clientInfo: { name: 'AttaSeek', version: '0.5.0' },
    })
    if (initResult) {
      await this.sendNotification('notifications/initialized', {})
    }
    this.connected = true
    console.log(`[MCP:${this.serverName}] connected`)
  }

  async disconnect(): Promise<void> {
    this.connected = false
    await this.transport.disconnect()
  }

  get isConnected(): boolean { return this.connected }

  /** List tools exposed by the MCP server */
  async listTools(): Promise<MCPToolDef[]> {
    const result = await this.sendRequest('tools/list', {}) as Record<string, unknown> | undefined
    return (result?.tools as MCPToolDef[]) || []
  }

  /** Call a tool on the MCP server */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.sendRequest('tools/call', { name, arguments: args }) as Record<string, unknown> | undefined
    return result?.content || result
  }

  /** List resources exposed by the MCP server */
  async listResources(): Promise<MCPResourceDef[]> {
    const result = await this.sendRequest('resources/list', {}) as Record<string, unknown> | undefined
    return (result?.resources as MCPResourceDef[]) || []
  }

  /** Read a resource from the MCP server */
  async readResource(uri: string): Promise<unknown> {
    const result = await this.sendRequest('resources/read', { uri }) as Record<string, unknown> | undefined
    return result?.contents || result
  }

  /** List prompts exposed by the MCP server */
  async listPrompts(): Promise<MCPPromptDef[]> {
    const result = await this.sendRequest('prompts/list', {}) as Record<string, unknown> | undefined
    return (result?.prompts as MCPPromptDef[]) || []
  }

  // ── JSON-RPC ──

  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void
    reject: (err: Error) => void
  }>()
  private requestId = 0

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++this.requestId
    const message = { jsonrpc: '2.0', id, method, params }

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`MCP request timeout: ${method}`))
      }, 30_000)

      this.pendingRequests.set(id, {
        resolve: (value: unknown) => { clearTimeout(timer); resolve(value) },
        reject: (err: Error) => { clearTimeout(timer); reject(err) },
      })

      this.transport.send(message).catch((err) => {
        this.pendingRequests.delete(id)
        reject(err)
      })
    })
  }

  private sendNotification(method: string, params: Record<string, unknown>): Promise<void> {
    return this.transport.send({ jsonrpc: '2.0', method, params })
  }
}
