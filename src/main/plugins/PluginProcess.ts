/**
 * PluginProcess — wraps a single plugin child process with lifecycle management.
 *
 * Spawns a child_process.fork() running PluginHostEntry, handles message
 * dispatch, health monitoring via heartbeat, and controlled shutdown.
 */

import { fork, type ChildProcess } from 'child_process'
import path from 'path'
import type {
  HostToPluginMessage,
  PluginToHostMessage,
  PluginContributionsSnapshot,
} from './PluginIPCProtocol'

// ── Types ──

export type PluginProcessState = 'spawning' | 'ready' | 'active' | 'error' | 'shutting_down' | 'dead'

export interface PluginProcessOptions {
  /** Plugin ID (for logging) */
  pluginId: string
  /** Absolute path to plugin.json */
  manifestPath: string
  /** Absolute path to plugin installation directory */
  pluginDir: string
  /** Startup timeout in ms (default: 30_000) */
  startupTimeoutMs?: number
  /** Heartbeat interval in ms (default: 15_000) */
  heartbeatTimeoutMs?: number
  /** Max memory in MB for the child process (default: 256) */
  maxMemoryMB?: number
  /** Max consecutive heartbeat misses before marking as dead (default: 3) */
  maxHeartbeatMisses?: number
  /** Called when the plugin's contributions are registered */
  onReady?: (contributions: PluginContributionsSnapshot) => void
  /** Called when a tool execution completes */
  onToolResult?: (callId: string, result: PluginToHostMessage & { type: 'toolResult' } | PluginToHostMessage & { type: 'toolError' }) => void
  /** Called when the plugin logs a message */
  onLog?: (level: string, message: string) => void
  /** Called when the plugin crashes or becomes unresponsive */
  onCrash?: (error: string) => void
}

// ── PluginProcess ──

export class PluginProcess {
  readonly pluginId: string
  private manifestPath: string
  private pluginDir: string
  private process: ChildProcess | null = null
  private state: PluginProcessState = 'spawning'
  private startupTimeoutMs: number
  private heartbeatTimeoutMs: number
  private maxMemoryMB: number
  private maxHeartbeatMisses: number
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastHeartbeat = 0
  private heartbeatMisses = 0
  private opts: PluginProcessOptions

  /** Pending tool execution callbacks by callId */
  private pendingTools = new Map<string, {
    resolve: (result: unknown) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>()

  constructor(opts: PluginProcessOptions) {
    this.pluginId = opts.pluginId
    this.manifestPath = opts.manifestPath
    this.pluginDir = opts.pluginDir
    this.startupTimeoutMs = opts.startupTimeoutMs ?? 30_000
    this.heartbeatTimeoutMs = opts.heartbeatTimeoutMs ?? 15_000
    this.maxMemoryMB = opts.maxMemoryMB ?? 256
    this.maxHeartbeatMisses = opts.maxHeartbeatMisses ?? 3
    this.opts = opts
  }

  get isAlive(): boolean {
    return this.process !== null && !this.process.killed && this.state !== 'dead'
  }

  get isReady(): boolean {
    return this.state === 'ready' || this.state === 'active'
  }

  get currentState(): PluginProcessState {
    return this.state
  }

  /** Spawn the plugin process and wait for 'ready' message. */
  async spawn(): Promise<void> {
    if (this.process) throw new Error(`Plugin ${this.pluginId} is already spawned`)

    const hostEntry = path.resolve(__dirname, '..', 'host', 'PluginHostEntry.js')

    return new Promise((resolve, reject) => {
      try {
        this.process = fork(hostEntry, [], {
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          execArgv: [`--max-old-space-size=${this.maxMemoryMB}`],
          env: { ...process.env, PLUGIN_DIR: this.pluginDir },
        })

        this.state = 'spawning'

        // Startup timeout
        const startupTimer = setTimeout(() => {
          this.kill()
          reject(new Error(`Plugin ${this.pluginId} startup timeout`))
        }, this.startupTimeoutMs)

        this.process.on('message', (msg: PluginToHostMessage) => {
          switch (msg.type) {
            case 'ready':
              clearTimeout(startupTimer)
              this.state = 'ready'
              this.lastHeartbeat = Date.now()
              this.startHeartbeat()
              this.opts.onReady?.(msg.contributions)
              resolve()
              break

            case 'toolResult':
              this.resolveTool(msg.callId, { success: true, output: msg.result.output })
              break

            case 'toolError':
              this.resolveTool(msg.callId, { success: false, error: msg.error })
              break

            case 'error':
              this.opts.onLog?.('error', `Plugin ${this.pluginId}: ${msg.error}`)
              if (msg.fatal) {
                this.state = 'error'
                this.opts.onCrash?.(msg.error)
              }
              break

            case 'log':
              this.opts.onLog?.(msg.level, `[${this.pluginId}] ${msg.message}`)
              break

            case 'heartbeat':
              this.lastHeartbeat = Date.now()
              this.heartbeatMisses = 0
              break
          }
        })

        this.process.on('exit', (code, signal) => {
          this.stopHeartbeat()
          this.state = 'dead'
          this.process = null

          // Reject all pending tool calls
          for (const [, pending] of this.pendingTools) {
            clearTimeout(pending.timer)
            pending.reject(new Error(`Plugin ${this.pluginId} exited (code=${code}, signal=${signal})`))
          }
          this.pendingTools.clear()

          if (code !== 0 && code !== null) {
            this.opts.onCrash?.(`Plugin ${this.pluginId} exited with code ${code}${signal ? `, signal ${signal}` : ''}`)
          }
        })

        this.process.on('error', (err) => {
          clearTimeout(startupTimer)
          reject(err)
        })

        this.process.stderr?.on('data', (data: Buffer) => {
          this.opts.onLog?.('error', `[${this.pluginId}:stderr] ${data.toString().trim()}`)
        })

        // Send init message
        const initMsg: HostToPluginMessage = {
          type: 'init',
          manifestPath: this.manifestPath,
          pluginDir: this.pluginDir,
        }
        this.process.send(initMsg)
      } catch (err) {
        reject(err)
      }
    })
  }

  /** Activate the plugin (after successful spawn). */
  activate(): void {
    if (this.state !== 'ready') {
      throw new Error(`Cannot activate plugin ${this.pluginId}: state is ${this.state}`)
    }
    this.state = 'active'
    const msg: HostToPluginMessage = { type: 'activate' }
    this.process?.send(msg)
  }

  /** Deactivate the plugin. */
  deactivate(): void {
    if (this.state === 'active' || this.state === 'ready') {
      const msg: HostToPluginMessage = { type: 'deactivate' }
      this.process?.send(msg)
    }
    this.state = 'shutting_down'
  }

  /** Execute a tool in the plugin process. Returns a Promise. */
  async executeTool(callId: string, toolName: string, input: Record<string, unknown>): Promise<unknown> {
    if (!this.process || !this.isAlive) {
      throw new Error(`Plugin ${this.pluginId} is not running`)
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingTools.delete(callId)
        reject(new Error(`Tool "${toolName}" execution timeout in plugin ${this.pluginId}`))
      }, 60_000) // 60s tool timeout

      this.pendingTools.set(callId, { resolve, reject, timer })

      const msg: HostToPluginMessage = {
        type: 'executeTool',
        callId,
        toolName,
        input,
      }
      this.process!.send(msg)
    })
  }

  /** Graceful shutdown — send shutdown message, kill after timeout. */
  async shutdown(forceTimeoutMs = 5_000): Promise<void> {
    if (!this.process || this.state === 'dead') return

    this.state = 'shutting_down'
    this.stopHeartbeat()

    const msg: HostToPluginMessage = { type: 'shutdown' }
    try { this.process.send(msg) } catch { /* ignore */ }

    // Give it time, then force kill
    await new Promise<void>((resolve) => {
      const forceTimer = setTimeout(() => {
        this.kill()
        resolve()
      }, forceTimeoutMs)

      this.process?.once('exit', () => {
        clearTimeout(forceTimer)
        resolve()
      })
    })
  }

  /** Force kill the process immediately. */
  kill(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM')
      // Double-tap: if not dead in 2s, SIGKILL
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL')
        }
      }, 2_000)
    }
    this.state = 'dead'
    this.stopHeartbeat()
  }

  // ── Heartbeat ──

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.lastHeartbeat = Date.now()
    this.heartbeatMisses = 0

    this.heartbeatTimer = setInterval(() => {
      const elapsed = Date.now() - this.lastHeartbeat
      if (elapsed > this.heartbeatTimeoutMs) {
        this.heartbeatMisses++
        if (this.heartbeatMisses >= this.maxHeartbeatMisses) {
          this.opts.onLog?.('error', `Plugin ${this.pluginId} unresponsive — killing`)
          this.opts.onCrash?.('Heartbeat timeout')
          this.kill()
        }
      }
      // Ping the child
      const msg: HostToPluginMessage = { type: 'heartbeatResponse' }
      try { this.process?.send(msg) } catch { /* process may be dead */ }
    }, this.heartbeatTimeoutMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // ── Helpers ──

  private resolveTool(callId: string, result: { success: boolean; output?: unknown; error?: string }): void {
    const pending = this.pendingTools.get(callId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pendingTools.delete(callId)

    if (result.success) {
      pending.resolve(result.output)
    } else {
      pending.reject(new Error(result.error || 'Tool execution failed'))
    }
  }
}
