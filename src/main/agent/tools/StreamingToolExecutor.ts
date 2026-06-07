/**
 * StreamingToolExecutor — execute tools as they arrive from LLM stream.
 *
 * Unlike the batch ToolOrchestrator (which waits for full LLM response),
 * this executor starts tool execution the moment a tool_use block is complete.
 *
 * Read-only tools execute immediately in parallel.
 * Write/risky tools queue up and execute sequentially in arrival order.
 *
 * Inspired by Claude Code's StreamingToolExecutor.
 */

import { toolExecutor } from '../../tools/ToolExecutor'
import { isReadOnly, isConcurrencySafe } from './ToolOrchestrator'
import type { ToolExecResult } from './ToolOrchestrator'

interface ToolSlot {
  index: number
  id: string
  name: string
  inputJson: string
  status: 'accumulating' | 'queued' | 'executing' | 'completed' | 'yielded'
  result?: ToolExecResult
  resolve?: () => void
}

export class StreamingToolExecutor {
  private slots = new Map<number, ToolSlot>()
  private taskId: string
  private sessionId: string
  private projectId?: string
  private completedResults: ToolExecResult[] = []
  private pendingResolve: (() => void) | null = null
  private cancelled = false

  constructor(taskId: string, sessionId: string, projectId?: string) {
    this.taskId = taskId
    this.sessionId = sessionId
    this.projectId = projectId
  }

  /** Register a tool_use_start event */
  addTool(index: number, id: string, name: string): void {
    this.slots.set(index, { index, id, name, inputJson: '', status: 'accumulating' })
  }

  /** Accumulate input JSON delta for a tool */
  accumulateInput(id: string, json: string): void {
    for (const slot of this.slots.values()) {
      if (slot.id === id && slot.status === 'accumulating') {
        slot.inputJson += json
        return
      }
    }
  }

  /** Try to complete a tool by ID/index. Returns true if it was found and completed. */
  tryCompleteTool(index: number, toolId?: string): boolean {
    return this.completeTool(index, toolId)
  }

  /** Called when content_block_stop arrives — triggers execution by tool ID */
  private completeTool(index: number, toolId?: string): boolean {
    // Try to find by ID first, then by index
    let slot: ToolSlot | undefined
    if (toolId) {
      for (const s of this.slots.values()) {
        if (s.id === toolId && s.status === 'accumulating') { slot = s; break }
      }
    }
    if (!slot) {
      slot = this.slots.get(index)
    }
    if (!slot || slot.status !== 'accumulating') return false

    slot.status = 'queued'

    if (isConcurrencySafe(slot.name)) {
      this.executeSlot(slot)
    }
    return true
  }

  /** Get results that have completed so far (non-blocking) — for streaming yields */
  getCompletedResults(): ToolExecResult[] {
    const ready: ToolExecResult[] = []
    for (const slot of this.slots.values()) {
      if (slot.status === 'completed' && slot.result) {
        slot.status = 'yielded'
        ready.push(slot.result)
      }
    }
    this.completedResults.push(...ready)
    return ready
  }

  /** Wait for all remaining tool executions to complete */
  async getRemainingResults(): Promise<ToolExecResult[]> {
    // Execute all queued write tools sequentially
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
    this.completedResults.push(...remaining)
    return remaining
  }

  /** Cancel all pending/executing tools */
  cancelAll(): void {
    this.cancelled = true
    for (const slot of this.slots.values()) {
      if (slot.resolve) slot.resolve()
    }
  }

  /** Total results collected so far */
  get allResults(): ToolExecResult[] {
    return [...this.completedResults]
  }

  // ── Private ──

  private async executeSlot(slot: ToolSlot): Promise<void> {
    if (this.cancelled) return

    slot.status = 'executing'
    try {
      let input: Record<string, unknown> = {}
      try { input = JSON.parse(slot.inputJson || '{}') } catch { /* use empty */ }

      const result = await toolExecutor.execute({
        toolId: slot.name,
        toolCallId: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        input,
        taskId: this.taskId,
        sessionId: this.sessionId,
        projectId: this.projectId,
      })

      slot.result = {
        toolCallId: `tc_${Date.now()}`,
        toolUse: { type: 'tool_use' as const, name: slot.name, id: slot.id, input },
        success: result.success,
        output: result.output,
        error: result.error,
        permissionDecision: result.permissionDecision,
      }
      slot.status = 'completed'
    } catch (err) {
      slot.result = {
        toolCallId: `tc_${Date.now()}`,
        toolUse: { type: 'tool_use' as const, name: slot.name, id: slot.id, input: {} },
        success: false,
        output: null,
        error: { code: 'EXECUTION_ERROR', message: err instanceof Error ? err.message : 'Unknown error', recoverable: false },
      }
      slot.status = 'completed'
    } finally {
      slot.resolve?.()
    }
  }
}
