/**
 * AgentRuntime — task lifecycle manager.
 *
 * Delegates execution to AgentLoop (real LLM agent loop).
 * The old mock transition table has been replaced.
 *
 * Fallback: if no LLM provider is configured, emit a helpful error message
 * via the event bus so the Conversation UI can guide the user to Settings.
 */

import { agentEventBus } from './AgentEventBus'
import { agentLoop } from './AgentLoop'
import { newId } from '../store/id'
import type { AgentTask, AgentTaskStatus } from '../../renderer/core/types/AgentTask'
import type { SessionEvent } from '../../renderer/core/types/SessionEvent'

export class AgentRuntime {
  private tasks = new Map<string, AgentTask>()

  /** Create and start a new agent task */
  createTask(sessionId: string, goal: string, projectId?: string, modelConfigId?: string, modelName?: string): AgentTask {
    const id = `task_${newId().slice(0, 8)}`
    const task: AgentTask = {
      id,
      sessionId,
      projectId,
      modelConfigId,
      modelName,
      goal,
      status: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.tasks.set(id, task)

    // Emit UserMessage event
    this.emit(task, 'UserMessage', { content: goal })

    // Start the agent loop (async, non-blocking)
    agentLoop.run(task).catch((err) => {
      console.error(`[AgentRuntime] task ${id} failed:`, err)
    })

    return task
  }

  /** Cancel a running task */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false

    agentLoop.cancel(taskId)

    task.status = 'cancelled'
    task.updatedAt = Date.now()
    this.emit(task, 'TaskFailed', { error: 'Task cancelled by user', recoverable: false })
    return true
  }

  /** Get a task by ID */
  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId)
  }

  /** List all tasks for a session */
  listBySession(sessionId: string): AgentTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.sessionId === sessionId)
  }

  // ── Event helper ──

  emit(task: AgentTask, type: SessionEvent['type'], payload: SessionEvent['payload']): void {
    agentEventBus.emit({
      id: newId(),
      sessionId: task.sessionId,
      taskId: task.id,
      type,
      payload,
      createdAt: Date.now(),
    })
  }
}

export const agentRuntime = new AgentRuntime()
