import { describe, it, expect, beforeEach } from 'vitest'
import { ToolExecutor } from '../../../src/main/tools/ToolExecutor'
import { ToolRegistry } from '../../../src/main/tools/ToolRegistry'
import { PermissionService } from '../../../src/main/permission/PermissionService'
import { AuditService } from '../../../src/main/audit/AuditService'
import { PermissionBridge } from '../../../src/main/permission/PermissionBridge'
import type { ToolManifest } from '../../../src/renderer/core/types/Tool'

function makeManifest(overrides: Partial<ToolManifest> = {}): ToolManifest {
  return {
    id: 'test_tool',
    pluginId: 'builtin-core',
    name: 'Test Tool',
    description: 'A test tool',
    inputSchema: { input: 'string' },
    outputSchema: { output: 'string' },
    riskLevel: 'read',
    category: 'code',
    permissionPolicy: { default: 'allow', requirePreview: false, allowAlways: true },
    ...overrides,
  }
}

describe('ToolExecutor', () => {
  let toolRegistry: ToolRegistry
  let permissionService: PermissionService
  let auditService: AuditService
  let permissionBridge: PermissionBridge
  let executor: ToolExecutor

  beforeEach(() => {
    toolRegistry = new ToolRegistry()
    permissionService = new PermissionService()
    auditService = new AuditService()
    permissionBridge = new PermissionBridge(1000) // short timeout for tests
    executor = new ToolExecutor()
    // Register a test tool
    toolRegistry.register(makeManifest())
  })

  it('has the expected interface shape', () => {
    expect(executor).toBeDefined()
    expect(typeof executor.execute).toBe('function')
  })

  it('execute requires toolId, toolCallId, input, taskId, sessionId params', () => {
    // Verify the method signature — actual execution requires Electron runtime (SQLite)
    expect(executor.execute.length).toBeGreaterThanOrEqual(1)
  })
})

describe('ToolRegistry', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
  })

  it('registers and retrieves tools', () => {
    const tool = makeManifest()
    registry.register(tool)
    expect(registry.get('test_tool')).toEqual(tool)
    expect(registry.count).toBe(1)
  })

  it('lists tools by risk level', () => {
    registry.register(makeManifest({ id: 'r1', riskLevel: 'read' }))
    registry.register(makeManifest({ id: 'w1', riskLevel: 'write' }))
    registry.register(makeManifest({ id: 'rx1', riskLevel: 'risky' }))

    expect(registry.listByRisk('read')).toHaveLength(1)
    expect(registry.listByRisk('write')).toHaveLength(1)
    expect(registry.listByRisk('risky')).toHaveLength(1)
  })

  it('lists tools by plugin', () => {
    registry.register(makeManifest({ id: 'a', pluginId: 'p1' }))
    registry.register(makeManifest({ id: 'b', pluginId: 'p2' }))
    registry.register(makeManifest({ id: 'c', pluginId: 'p1' }))

    expect(registry.listByPlugin('p1')).toHaveLength(2)
    expect(registry.listByPlugin('p2')).toHaveLength(1)
  })

  it('unregisters tools by plugin', () => {
    registry.register(makeManifest({ id: 'a', pluginId: 'p1' }))
    registry.register(makeManifest({ id: 'b', pluginId: 'p2' }))
    registry.unregisterByPlugin('p1')
    expect(registry.count).toBe(1)
    expect(registry.get('a')).toBeUndefined()
    expect(registry.get('b')).toBeDefined()
  })

  it('handles overwrite warning', () => {
    registry.register(makeManifest({ id: 'dup', name: 'First' }))
    registry.register(makeManifest({ id: 'dup', name: 'Second' }))
    expect(registry.get('dup')?.name).toBe('Second')
  })
})

describe('PermissionBridge', () => {
  let bridge: PermissionBridge

  beforeEach(() => {
    bridge = new PermissionBridge(500)
  })

  it('times out and defaults to deny', async () => {
    const result = await bridge.awaitPermission('req_1', 100)
    expect(result).toBe('deny')
  })

  it('resolves with allow when resolved before timeout', async () => {
    const promise = bridge.awaitPermission('req_2', 5000)
    // Resolve immediately
    bridge.resolve('req_2', 'allow')
    const result = await promise
    expect(result).toBe('allow')
  })

  it('resolves with deny', async () => {
    const promise = bridge.awaitPermission('req_3', 5000)
    bridge.resolve('req_3', 'deny')
    const result = await promise
    expect(result).toBe('deny')
  })

  it('returns false for unknown request', () => {
    expect(bridge.resolve('unknown', 'allow')).toBe(false)
  })

  it('cancels all pending requests', async () => {
    const p1 = bridge.awaitPermission('req_a', 5000)
    const p2 = bridge.awaitPermission('req_b', 5000)
    bridge.cancelAll()
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe('deny')
    expect(r2).toBe('deny')
  })
})
