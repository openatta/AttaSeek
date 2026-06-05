/**
 * AgentRuntime — task lifecycle manager.
 *
 * Delegates execution to AgentOrchestrator (universal agent engine).
 * Creates a new orchestrator per task to ensure isolation.
 */

import { agentEventBus } from './AgentEventBus'
import { AgentOrchestrator } from './orchestrator/AgentOrchestrator'
import { newId } from '../store/id'
import { validateProfile } from './profile/AgentProfile'
import type { AgentTask } from '../../shared/types/AgentTask'
import type { SessionEvent } from '../../shared/types/SessionEvent'
import type { AgentProfile } from './profile/AgentProfile'

const MAX_TASKS = 500

export class AgentRuntime {
  private tasks = new Map<string, AgentTask>()
  private activeExecutions = new Map<string, AgentOrchestrator>()

  /** Create and start a new agent task */
  createTask(sessionId: string, goal: string, projectId?: string, modelConfigId?: string, modelName?: string, profile?: AgentProfile): AgentTask {
    // Evict oldest completed/failed tasks if at capacity
    if (this.tasks.size >= MAX_TASKS) {
      for (const [tid, t] of this.tasks) {
        if (t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled') {
          this.tasks.delete(tid)
          if (this.tasks.size < MAX_TASKS) break
        }
      }
    }
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

    // Start orchestrator (per-task instance, non-blocking)
    this.runOrchestrator(task, profile).catch((err) => {
      console.error(`[AgentRuntime] task ${id} failed:`, err)
    })

    return task
  }

  /** Cancel a running task */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false

    const exec = this.activeExecutions.get(taskId)
    if (exec) {
      exec.interrupt()
      this.activeExecutions.delete(taskId)
    }

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

  // ── Private ──

  private async runOrchestrator(task: AgentTask, profile?: AgentProfile): Promise<void> {
    const orchestrator = new AgentOrchestrator()
    this.activeExecutions.set(task.id, orchestrator)

    try {
      const effectiveProfile = profile || getDefaultProfile()
      for await (const event of orchestrator.submitMessage(task, effectiveProfile)) {
        agentEventBus.emit(event)
      }
      // Only set completed if not already overridden by cancel
      if (task.status !== 'cancelled') {
        task.status = 'completed'
      }
    } catch (err) {
      if (task.status !== 'cancelled') {
        task.status = 'failed'
        task.updatedAt = Date.now()
        this.emit(task, 'TaskFailed', {
          error: err instanceof Error ? err.message : 'Unknown error',
          recoverable: true,
        })
      }
    } finally {
      this.activeExecutions.delete(task.id)
    }
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

// ── Default profile (module-level, allocated once) ──

let _defaultProfile: AgentProfile | null = null

function getDefaultProfile(): AgentProfile {
  if (!_defaultProfile) {
    _defaultProfile = validateProfile({
      id: 'default',
      name: 'AttaSeek Agent',
      description: 'General-purpose AI agent.',
      systemPrompt: { id: 'default', sections: [{ name: 'identity', priority: 10, content: `You are an AI agent running in AttaSeek. Use tools when needed. Be concise and helpful.` }] },
      tools: [], skills: [],
      execution: { maxParallelTools: 1 }, // conservative default for unknown profiles
    })
  }
  return _defaultProfile
}

export const agentRuntime = new AgentRuntime()
