/**
 * StreamingToolExecutor — execute tools as LLM streams them in.
 *
 * Full state machine per tool slot:
 *   accumulating → queued → executing → completed → yielded
 *
 * Features (Phase D additions):
 *   - Sibling abort: Bash error → siblingAbortController.abort() kills
 *     concurrent sibling subprocesses without aborting the parent turn.
 *   - Discard: streaming fallback (model switch) → discard() abandons
 *     in-flight tools and yields synthetic error results.
 *   - Progress: tools report real-time progress via ToolProgressBus.
 *
 * Mirrors Claude Code's StreamingToolExecutor (src/services/tools/StreamingToolExecutor.ts).
 *
 * Phase D: full implementation replacing the Phase A/B simplified version.
 */

import { toolExecutor } from '../../tools/ToolExecutor'
import { ToolProgressBus } from './ToolProgressBus'
import type { ToolProgressCallback, ProgressMessage } from '../messages/MessageTypes'
import type { ToolExecResult } from './ToolOrchestrator'

// ── Slot state machine ──

type SlotStatus = 'accumulating' | 'queued' | 'executing' | 'completed' | 'yielded'

interface ToolSlot {
  index: number
  id: string
  name: string
  inputJson: string
  status: SlotStatus
  isConcurrencySafe: boolean
  /** For progress reporting. */
  progressCallback?: ToolProgressCallback
  /** Pending progress events (collected during execution, yielded after). */
  pendingProgress: ProgressMessage[]
  /** Execution result. */
  result?: ToolExecResult
  /** Resolve when this slot's execution finishes. */
  resolve?: () => void
  /** Context modifier returned by this tool (applied after all tools finish). */
  contextModifiers?: Array<(ctx: unknown) => unknown>
}

// ── Executor ──

export class StreamingToolExecutor {
  private slots = new Map<number, ToolSlot>()
  private taskId: string
  private sessionId: string
  private projectId?: string
  private cancelled = false
  private discarded = false

  /** Shared abort controller — aborting this kills sibling processes. */
  readonly siblingAbortController: AbortController

  /** Progress event bus for this turn. */
  readonly progressBus = new ToolProgressBus()

  constructor(
    taskId: string,
    sessionId: string,
    projectId?: string,
    parentAbortController?: AbortController,
  ) {
    this.taskId = taskId
    this.sessionId = sessionId
    this.projectId = projectId

    // Create sibling abort controller as child of parent
    this.siblingAbortController = new AbortController()
    if (parentAbortController) {
      const parentSignal = parentAbortController.signal
      if (parentSignal.aborted) {
        this.siblingAbortController.abort()
      } else {
        parentSignal.addEventListener('abort', () => {
          this.siblingAbortController.abort()
        }, { once: true })
      }
    }
  }

  // ── Registration (called during LLM streaming) ──

  /** Register a tool_use_start event. */
  addTool(index: number, id: string, name: string, isConcurrencySafe: boolean = true): void {
    if (this.discarded) return
    const progressCallback = this.progressBus.register(id, name)
    this.slots.set(index, {
      index, id, name, inputJson: '',
      status: 'accumulating',
      isConcurrencySafe,
      progressCallback,
      pendingProgress: [],
    })
  }

  /** Accumulate input JSON delta for a tool. */
  accumulateInput(id: string, json: string): void {
    if (this.discarded) return
    for (const slot of this.slots.values()) {
      if (slot.id === id && slot.status === 'accumulating') {
        slot.inputJson += json
        return
      }
    }
  }

  /** Called when content_block_stop arrives — triggers execution. */
  tryCompleteTool(index: number, toolId?: string): boolean {
    if (this.discarded) return false

    // Find by ID first, then by index
    let slot: ToolSlot | undefined
    if (toolId) {
      for (const s of this.slots.values()) {
        if (s.id === toolId && s.status === 'accumulating') { slot = s; break }
      }
    }
    if (!slot) slot = this.slots.get(index)
    if (!slot || slot.status !== 'accumulating') return false

    slot.status = 'queued'

    // Start execution immediately if concurrency-safe
    if (slot.isConcurrencySafe && !this.cancelled) {
      this.executeSlot(slot)
    }
    return true
  }

  // ── Collect results (called after LLM streaming ends) ──

  /** Get results that have completed so far (non-blocking). */
  getCompletedResults(): ToolExecResult[] {
    const ready: ToolExecResult[] = []
    for (const slot of this.slots.values()) {
      if (slot.status === 'completed' && slot.result) {
        slot.status = 'yielded'
        ready.push(slot.result)
      }
    }
    return ready
  }

  /** Wait for all remaining tool executions to complete. */
  async getRemainingResults(): Promise<ToolExecResult[]> {
    // Execute all queued non-concurrency-safe tools sequentially
    for (const slot of this.slots.values()) {
      if (slot.status === 'queued') {
        await this.executeSlot(slot)
      }
    }

    // Wait for any still-executing tools
    const promises: Promise<void>[] = []
    for (const slot of this.slots.values()) {
      if (slot.status === 'executing') {
        promises.push(new Promise<void>((resolve) => { slot.resolve = resolve }))
      }
    }
    if (promises.length > 0) {
      await Promise.all(promises)
    }

    // Collect remaining completed results
    const remaining: ToolExecResult[] = []
    for (const slot of this.slots.values()) {
      if (slot.status === 'completed' && slot.result) {
        slot.status = 'yielded'
        remaining.push(slot.result)
      }
    }
    return remaining
  }

  // ── Lifecycle ──

  /**
   * Discard all pending and in-progress tools.
   * Called when streaming fallback occurs (model switch mid-stream) —
   * results from the failed model attempt must be abandoned.
   *
   * Queued tools won't start; in-progress tools get synthetic errors.
   */
  discard(): void {
    this.discarded = true
    for (const slot of this.slots.values()) {
      if (slot.status === 'queued') {
        slot.status = 'completed'
        slot.result = {
          toolCallId: slot.id,
          toolUse: { type: 'tool_use' as const, name: slot.name, id: slot.id, input: {} },
          success: false,
          output: null,
          error: {
            code: 'STREAMING_FALLBACK',
            message: `Tool execution discarded due to streaming fallback (model switch)`,
            recoverable: false,
          },
        }
      }
      if (slot.resolve) slot.resolve()
    }
  }

  /** Cancel all pending and executing tools. */
  cancelAll(): void {
    this.cancelled = true
    for (const slot of this.slots.values()) {
      // Resolve waiting promises so getRemainingResults unblocks
      if (slot.resolve) slot.resolve()
    }
  }

  /** All results collected and yielded so far (via getCompletedResults / getRemainingResults). */
  get allResults(): ToolExecResult[] {
    // Only return yielded slots — same semantics as the old completedResults array.
    // Without this, combining allResults + getRemainingResults() would double-count
    // completed-but-not-yet-yielded tools.
    const results: ToolExecResult[] = []
    for (const slot of this.slots.values()) {
      if (slot.status === 'yielded' && slot.result) {
        results.push(slot.result)
      }
    }
    return results
  }

  /** Number of slots. */
  get slotCount(): number {
    return this.slots.size
  }

  /** Check if any executing tool has errored (for sibling abort decision). */
  get hasError(): boolean {
    for (const slot of this.slots.values()) {
      if (slot.result && !slot.result.success) return true
    }
    return false
  }

  // ── Private ──

  private async executeSlot(slot: ToolSlot): Promise<void> {
    if (this.cancelled || this.discarded) return

    slot.status = 'executing'

    // Report progress: started
    slot.progressCallback?.({
      type: 'progress',
      toolCallId: slot.id,
      toolName: slot.name,
      stage: 'started',
      message: `Running ${slot.name}...`,
    })

    try {
      let input: Record<string, unknown> = {}
      try { input = JSON.parse(slot.inputJson || '{}') } catch { /* use empty */ }

      const result = await toolExecutor.execute({
        toolId: slot.name,
        toolCallId: slot.id,
        input,
        taskId: this.taskId,
        sessionId: this.sessionId,
        projectId: this.projectId,
      })

      slot.result = {
        toolCallId: slot.id,
        toolUse: { type: 'tool_use' as const, name: slot.name, id: slot.id, input },
        success: result.success,
        output: result.output,
        error: result.error,
        permissionDecision: result.permissionDecision,
      }

      // Report progress: done
      const finalStage = result.success ? 'completed' : 'failed'
      slot.progressCallback?.({
        type: 'progress',
        toolCallId: slot.id,
        toolName: slot.name,
        stage: finalStage,
        message: result.success ? `${slot.name} completed` : `Error: ${result.error?.message || 'Unknown'}`,
      })
    } catch (err) {
      slot.result = {
        toolCallId: slot.id,
        toolUse: { type: 'tool_use' as const, name: slot.name, id: slot.id, input: {} },
        success: false,
        output: null,
        error: {
          code: 'EXECUTION_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
          recoverable: false,
        },
      }

      slot.progressCallback?.({
        type: 'progress',
        toolCallId: slot.id,
        toolName: slot.name,
        stage: 'failed',
        message: `Fatal: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })

      // Sibling abort: if this tool wrote files or ran commands, abort siblings
      // to prevent them from acting on stale state.
      if (!slot.isConcurrencySafe) {
        this.siblingAbortController.abort()
      }
    } finally {
      slot.status = 'completed'
      slot.resolve?.()
    }
  }
}
