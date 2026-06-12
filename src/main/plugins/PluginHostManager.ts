/**
 * PluginHostManager — orchestrates lifecycle of all isolated plugin processes.
 *
 * Manages spawning, health monitoring, crash recovery, and graceful shutdown
 * for marketplace plugins running in child_process.fork().
 *
 * Built-in/bundled plugins continue to load synchronously via PluginLoader
 * (no process isolation needed).
 */

import { PluginProcess } from './PluginProcess'
import type { PluginContributionsSnapshot } from './PluginIPCProtocol'
import { pluginRegistry } from './PluginRegistry'
import { toolRegistry } from '../tools/ToolRegistry'
import { skillRegistry } from '../skills/SkillRegistry'

// ── Types ──

export interface SpawnPluginOptions {
  pluginId: string
  manifestPath: string
  pluginDir: string
  maxMemoryMB?: number
  startupTimeoutMs?: number
}

export interface HostManagerState {
  running: number
  ready: number
  dead: number
}

// ── PluginHostManager ──

export class PluginHostManager {
  private processes = new Map<string, PluginProcess>()
  private crashCounts = new Map<string, { count: number; firstCrash: number }>()
  private maxRestarts = 3
  private restartWindowMs = 60_000 // 1 minute
  private toolRouteTable = new Map<string, string>() // toolName → pluginId

  /** Spawn a plugin in an isolated process. Returns once 'ready' is received. */
  async spawnPlugin(opts: SpawnPluginOptions): Promise<PluginContributionsSnapshot | null> {
    const { pluginId } = opts

    // Prevent duplicate spawns
    if (this.processes.has(pluginId)) {
      console.warn(`[PluginHostManager] plugin ${pluginId} already spawned`)
      return null
    }

    const proc = new PluginProcess({
      pluginId,
      manifestPath: opts.manifestPath,
      pluginDir: opts.pluginDir,
      maxMemoryMB: opts.maxMemoryMB,
      startupTimeoutMs: opts.startupTimeoutMs,
      onReady: (contributions) => {
        this.handleContributions(pluginId, contributions)
      },
      onToolResult: (callId, result) => {
        // Results are delivered directly via executeTool Promise
      },
      onLog: (level, message) => {
        const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
        fn(`[PluginHostManager] ${message}`)
      },
      onCrash: (error) => {
        console.error(`[PluginHostManager] plugin ${pluginId} crashed: ${error}`)
        this.handleCrash(pluginId, opts)
      },
    })

    this.processes.set(pluginId, proc)

    let contributions: PluginContributionsSnapshot | null = null

    try {
      // Override onReady to capture contributions for the return value
      const originalOnReady = (proc as any).opts.onReady
      ;(proc as any).opts.onReady = (c: PluginContributionsSnapshot) => {
        contributions = c
        originalOnReady?.(c)
      }

      await proc.spawn()
      proc.activate()
      return contributions
    } catch (err) {
      console.error(`[PluginHostManager] failed to spawn plugin ${pluginId}:`, (err as Error).message)
      this.processes.delete(pluginId)
      return null
    }
  }

  /** Execute a tool call in the appropriate plugin process. */
  async executeTool(pluginId: string, callId: string, toolName: string, input: Record<string, unknown>): Promise<unknown> {
    const proc = this.processes.get(pluginId)
    if (!proc || !proc.isAlive) {
      throw new Error(`Plugin ${pluginId} is not running`)
    }
    return proc.executeTool(callId, toolName, input)
  }

  /** Get the plugin ID that owns a given tool. */
  getToolOwner(toolName: string): string | null {
    return this.toolRouteTable.get(toolName) || null
  }

  /** Deactivate a plugin process. */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const proc = this.processes.get(pluginId)
    if (!proc) return
    proc.deactivate()
    await proc.shutdown()
    this.processes.delete(pluginId)
    this.removeContributions(pluginId)
  }

  /** Shut down all plugin processes. */
  async shutdownAll(): Promise<void> {
    const procs = Array.from(this.processes.values())
    await Promise.all(procs.map(p => p.shutdown().catch(() => {})))
    this.processes.clear()
    this.toolRouteTable.clear()
  }

  /** Get aggregate state for monitoring. */
  getState(): HostManagerState {
    let running = 0, ready = 0, dead = 0
    for (const proc of this.processes.values()) {
      running++
      if (proc.isReady) ready++
      if (!proc.isAlive) dead++
    }
    return { running, ready, dead }
  }

  // ── Internal ──

  private handleContributions(pluginId: string, contributions: PluginContributionsSnapshot): void {
    // Register tools with the tool registry and build route table
    if (contributions.tools) {
      for (const tool of contributions.tools) {
        // Register a proxy tool manifest in the main-process ToolRegistry
        toolRegistry.register({
          id: `plugin:${pluginId}:${tool.name}`,
          pluginId,
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: tool.inputSchema.properties || {},
            ...(Array.isArray(tool.inputSchema.required) && { required: tool.inputSchema.required }),
          },
          riskLevel: (tool.riskLevel === 'modify' ? 'write' : tool.riskLevel) as 'read' | 'write' | 'risky',
          category: 'plugin' as any,
          outputSchema: { type: 'object', properties: {} },
          permissionPolicy: { default: 'ask', requirePreview: false, allowAlways: false },
        })
        this.toolRouteTable.set(tool.name, pluginId)
      }
    }

    // Register skills
    if (contributions.skills) {
      for (const skill of contributions.skills) {
        skillRegistry.register({
          ...skill,
          pluginId,
        } as any)
      }
    }

    // Update plugin registry status
    const instance = pluginRegistry.get(pluginId)
    if (instance) {
      pluginRegistry.activate(pluginId)
    }

    console.log(`[PluginHostManager] plugin ${pluginId} contributions registered: ${contributions.tools?.length || 0} tools, ${contributions.skills?.length || 0} skills`)
  }

  private removeContributions(pluginId: string): void {
    // Remove tool routes
    for (const [toolName, owner] of this.toolRouteTable) {
      if (owner === pluginId) this.toolRouteTable.delete(toolName)
    }
    // Unregister tools and skills
    toolRegistry.unregisterByPlugin(pluginId)
    skillRegistry.unregisterByPlugin(pluginId)
  }

  private handleCrash(pluginId: string, opts: SpawnPluginOptions): void {
    const now = Date.now()
    const record = this.crashCounts.get(pluginId) || { count: 0, firstCrash: now }

    // Reset the crash window if it expired
    if (now - record.firstCrash > this.restartWindowMs) {
      record.count = 0
      record.firstCrash = now
    }

    record.count++
    this.crashCounts.set(pluginId, record)

    if (record.count > this.maxRestarts) {
      console.error(`[PluginHostManager] plugin ${pluginId} exceeded max restarts (${this.maxRestarts}) — marking as error`)
      pluginRegistry.onPluginError(
        pluginId,
        new Error(`Plugin crashed ${record.count} times within ${this.restartWindowMs / 1000}s — disabled`),
      )
      this.removeContributions(pluginId)
      return
    }

    // Auto-restart with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, record.count - 1), 16_000)
    console.log(`[PluginHostManager] restarting plugin ${pluginId} in ${delay}ms (attempt ${record.count}/${this.maxRestarts})`)

    setTimeout(() => {
      this.spawnPlugin(opts).catch((err) => {
        console.error(`[PluginHostManager] plugin ${pluginId} restart failed:`, (err as Error).message)
      })
    }, delay)
  }
}

/** Singleton */
export const pluginHostManager = new PluginHostManager()
