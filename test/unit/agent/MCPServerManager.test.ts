/**
 * Unit tests for MCPServerManager — server lifecycle and tool registration.
 *
 * Tests the server management logic without starting real MCP subprocesses.
 * Focuses on registration and basic lifecycle.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mock MCP dependencies (vi.mock is hoisted — no top-level variables allowed) ──

vi.mock('../../../src/main/agent/mcp/MCPTransport', () => ({
  createTransport: vi.fn(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    isRunning: false,
    onError: vi.fn(),
    onExit: vi.fn(),
    onStdout: vi.fn(),
    send: vi.fn(),
  })),
}))

vi.mock('../../../src/main/agent/mcp/MCPClient', () => ({
  MCPClient: vi.fn().mockImplementation((id: string) => ({
    id,
    initialize: vi.fn().mockResolvedValue({ protocolVersion: '2024-11-05', serverInfo: { name: id, version: '1.0' } }),
    listTools: vi.fn().mockResolvedValue([
      { name: 'mcp_tool_1', description: 'MCP tool', inputSchema: { type: 'object' } },
    ]),
    listPrompts: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }),
  })),
}))

vi.mock('../../../src/main/agent/mcp/MCPConfigLoader', () => ({
  loadMCPConfigs: vi.fn(() => []),
}))

vi.mock('../../../src/main/agent/mcp/MCPBridge', () => ({
  mcpToolToManifest: vi.fn((tool: { name: string; description: string; inputSchema: object }, serverId: string) => ({
    id: `mcp__${serverId}__${tool.name}`,
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    pluginId: `mcp:${serverId}`,
  })),
  mcpPromptToSkill: vi.fn((prompt: { name: string; description: string }, serverId: string) => ({
    id: `mcp_prompt__${serverId}__${prompt.name}`,
    name: prompt.name,
    description: prompt.description,
    pluginId: `mcp:${serverId}`,
  })),
}))

vi.mock('../../../src/main/tools/ToolRegistry', () => ({
  toolRegistry: {
    register: vi.fn(),
    unregisterByPlugin: vi.fn(),
    listByPlugin: vi.fn(() => []),
    unregister: vi.fn(),
  },
}))

vi.mock('../../../src/main/skills/SkillRegistry', () => ({
  skillRegistry: {
    register: vi.fn(),
    unregisterByPlugin: vi.fn(),
    listByPlugin: vi.fn(() => []),
    unregister: vi.fn(),
  },
}))

// ── Import under test (must come AFTER all vi.mock calls) ──

import { MCPServerManager } from '../../../src/main/agent/mcp/MCPServerManager'

describe('MCPServerManager', () => {
  let manager: MCPServerManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new MCPServerManager()
  })

  it('creates an instance', () => {
    expect(manager).toBeDefined()
  })

  it('loads no servers when config is empty', async () => {
    const result = await manager.boot()
    expect(result.connected).toEqual([])
    expect(result.failed).toEqual([])
  })

  it('exposes boot method that returns connected/failed counts', async () => {
    const result = await manager.boot()
    expect(result).toHaveProperty('connected')
    expect(result).toHaveProperty('failed')
    expect(Array.isArray(result.connected)).toBe(true)
    expect(Array.isArray(result.failed)).toBe(true)
  })
})
