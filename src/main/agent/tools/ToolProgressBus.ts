/**
 * ToolProgressBus — real-time progress event emitter for tool execution.
 *
 * Each tool can report progress during long-running operations (e.g.,
 * bash scripts, file downloads, large file processing). Progress
 * events are emitted via callbacks and collected by the orchestrator
 * for forwarding to the UI.
 *
 * Mirrors Claude Code's tool progress system (ToolProgress type in Tool.ts).
 *
 * Phase D: progress bus integrated into StreamingToolExecutor.
 */

import type { ToolProgressCallback } from '../messages/MessageTypes'

// ── Progress stage enum ──

export type ProgressStage =
  | 'started'      // Tool execution began
  | 'running'      // Tool is actively doing work
  | 'blocked'      // Tool is waiting on user input (permission dialog)
  | 'finishing'    // Tool is wrapping up
  | 'completed'    // Tool finished successfully
  | 'failed'       // Tool finished with error

// ── Progress event ──

export interface ToolProgressEvent {
  /** Discriminant for type narrowing. */
  type: 'progress'
  /** The tool call this progress belongs to. */
  toolCallId: string
  /** Tool name. */
  toolName: string
  /** Current execution stage. */
  stage: ProgressStage
  /** Human-readable progress message. */
  message: string
  /** 0–100, only meaningful when stage is 'running'. */
  percentComplete?: number
  /** Timestamp (ms since epoch). */
  timestamp: number
}

// ── Progress bus ──

/**
 * Lightweight progress event emitter for tool execution.
 * One instance per StreamingToolExecutor (per turn).
 *
 * Usage by tool implementations:
 * ```
 * const onProgress = progressBus.register(toolCallId, toolName)
 * onProgress({ stage: 'running', message: 'Downloading...', percentComplete: 50 })
 * ```
 */
export class ToolProgressBus {
  /** All progress events emitted this turn, in order. */
  private events: ToolProgressEvent[] = []

  /** Per-tool callback registrations. */
  private listeners = new Map<string, Set<ToolProgressCallback>>()

  /** Global listener (receives all progress events). */
  private globalListener: ToolProgressCallback | null = null

  // ── Public API ──

  /**
   * Register a tool for progress reporting. Returns a callback the tool
   * implementation can call to report progress.
   */
  register(toolCallId: string, toolName: string): ToolProgressCallback {
    return (event) => {
      this.emit({ ...event, toolCallId, toolName } as ToolProgressEvent)
    }
  }

  /** Subscribe to progress events for a specific tool. */
  on(toolCallId: string, cb: ToolProgressCallback): void {
    let set = this.listeners.get(toolCallId)
    if (!set) {
      set = new Set()
      this.listeners.set(toolCallId, set)
    }
    set.add(cb)
  }

  /** Subscribe to ALL progress events (global listener). */
  onAll(cb: ToolProgressCallback): void {
    this.globalListener = cb
  }

  /** Emit a progress event. Called by tool implementations via their callback. */
  emit(event: ToolProgressEvent): void {
    event.timestamp = event.timestamp || Date.now()
    this.events.push(event)

    // Notify per-tool listeners
    const set = this.listeners.get(event.toolCallId)
    if (set) {
      for (const cb of set) cb(event)
    }

    // Notify global listener
    if (this.globalListener) {
      this.globalListener(event)
    }
  }

  // ── Query ──

  /** Get all progress events emitted so far. */
  getAll(): ReadonlyArray<ToolProgressEvent> {
    return this.events
  }

  /** Get progress events for a specific tool. */
  getForTool(toolCallId: string): ToolProgressEvent[] {
    return this.events.filter(e => e.toolCallId === toolCallId)
  }

  /** Get only completed/failed events (for yield-after-execution). */
  getFinal(): ToolProgressEvent[] {
    return this.events.filter(
      e => e.stage === 'completed' || e.stage === 'failed',
    )
  }

  /** Get the latest event for each tool. */
  getLatest(): Map<string, ToolProgressEvent> {
    const latest = new Map<string, ToolProgressEvent>()
    for (const e of this.events) {
      latest.set(e.toolCallId, e)
    }
    return latest
  }

  /** Check if any tool is currently blocked on user input. */
  get hasBlocked(): boolean {
    return this.events.some(e => e.stage === 'blocked')
  }

  /** Number of events emitted. */
  get size(): number {
    return this.events.length
  }

  /** Clear all events and listeners. */
  clear(): void {
    this.events = []
    this.listeners.clear()
    this.globalListener = null
  }
}
