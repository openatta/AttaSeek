/**
 * MonitorManager — Background monitor for streaming command output.
 *
 * Manages long-running shell commands that emit events on stdout.
 * Each stdout line becomes a notification in the agent session.
 *
 * Mirrors Claude Code's Monitor tool pattern.
 */

import { spawn, type ChildProcess } from 'child_process'

// ── Types ──

export interface MonitorInstance {
  id: string
  command: string
  description: string
  process: ChildProcess
  persistent: boolean
  startedAt: number
  lineCount: number
}

export interface MonitorEvent {
  monitorId: string
  line: string
  timestamp: number
}

// ── Constants ──

const MAX_MONITORS = 20
const MAX_LINES_PER_BATCH = 50
const BATCH_WINDOW_MS = 200

// ── Implementation ──

export class MonitorManager {
  private monitors = new Map<string, MonitorInstance>()
  private onEvent: ((event: MonitorEvent) => void) | null = null

  /**
   * Set the event callback — called each time a monitor emits a line.
   */
  setEventHandler(handler: (event: MonitorEvent) => void): void {
    this.onEvent = handler
  }

  /**
   * Start a new monitor.
   *
   * @param command     - Shell command to run.
   * @param description - Human-readable description for notifications.
   * @param persistent  - If true, runs until explicitly stopped; otherwise exits naturally.
   * @param timeoutMs   - Max runtime (ignored for persistent monitors).
   */
  start(
    command: string,
    description: string,
    persistent: boolean = false,
    timeoutMs?: number,
  ): { id: string; error?: string } {
    if (this.monitors.size >= MAX_MONITORS) {
      return { id: '', error: `Max ${MAX_MONITORS} concurrent monitors reached` }
    }

    const id = `mon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

    const proc = spawn('sh', ['-c', command], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    const monitor: MonitorInstance = {
      id, command, description, process: proc,
      persistent, startedAt: Date.now(), lineCount: 0,
    }
    this.monitors.set(id, monitor)

    // Batch stdout lines within a time window
    let batchBuffer: string[] = []
    let batchTimer: ReturnType<typeof setTimeout> | null = null

    const flushBatch = () => {
      if (batchBuffer.length === 0) return
      const lines = batchBuffer.splice(0)
      if (this.onEvent) {
        for (const line of lines) {
          this.onEvent({ monitorId: id, line, timestamp: Date.now() })
        }
      }
      monitor.lineCount += lines.length
    }

    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      batchBuffer.push(...lines)

      if (!batchTimer) {
        batchTimer = setTimeout(() => {
          flushBatch()
          batchTimer = null
        }, BATCH_WINDOW_MS)
      }

      // Flush immediately if batch is large
      if (batchBuffer.length >= MAX_LINES_PER_BATCH) {
        if (batchTimer) { clearTimeout(batchTimer); batchTimer = null }
        flushBatch()
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      // Stderr lines are also events
      const lines = data.toString().split('\n').filter(Boolean)
      if (this.onEvent) {
        for (const line of lines) {
          this.onEvent({ monitorId: id, line: `[stderr] ${line}`, timestamp: Date.now() })
        }
      }
    })

    proc.on('close', (code) => {
      if (batchTimer) { clearTimeout(batchTimer); batchTimer = null }
      flushBatch()
      if (this.onEvent) {
        this.onEvent({
          monitorId: id,
          line: `[Monitor "${description}" exited with code ${code}]`,
          timestamp: Date.now(),
        })
      }
      // Non-persistent monitors auto-cleanup
      if (!persistent) {
        this.monitors.delete(id)
      }
    })

    proc.on('error', (err) => {
      if (this.onEvent) {
        this.onEvent({
          monitorId: id,
          line: `[Monitor "${description}" error: ${err.message}]`,
          timestamp: Date.now(),
        })
      }
      this.monitors.delete(id)
    })

    // Auto-stop for non-persistent monitors
    if (!persistent && timeoutMs) {
      setTimeout(() => {
        if (this.monitors.has(id)) {
          this.stop(id)
        }
      }, timeoutMs)
    }

    return { id }
  }

  /** Stop a running monitor. */
  stop(id: string): boolean {
    const monitor = this.monitors.get(id)
    if (!monitor) return false
    monitor.process.kill('SIGTERM')
    // Give it 3 seconds to clean up, then force kill
    setTimeout(() => {
      if (monitor.process.exitCode === null) {
        try { monitor.process.kill('SIGKILL') } catch { /* already dead */ }
      }
    }, 3000)
    this.monitors.delete(id)
    return true
  }

  /** Stop all monitors. */
  stopAll(): void {
    for (const [id] of this.monitors) {
      this.stop(id)
    }
  }

  /** List active monitors. */
  list(): MonitorInstance[] {
    return Array.from(this.monitors.values()).map(m => ({
      id: m.id,
      command: m.command,
      description: m.description,
      process: m.process,
      persistent: m.persistent,
      startedAt: m.startedAt,
      lineCount: m.lineCount,
    }))
  }
}

/** Singleton instance. */
export const monitorManager = new MonitorManager()
