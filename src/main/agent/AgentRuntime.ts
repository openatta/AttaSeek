/**
 * AgentRuntime — task lifecycle manager.
 *
 * Phase B: delegates execution to QueryEngine (one-per-session) via
 * query-loop. QueryEngine accumulates conversation state across turns
 * within the same session.
 */

import { agentEventBus } from './AgentEventBus'
import { QueryEngine, getQueryEngine, removeQueryEngine } from './orchestrator/QueryEngine'
import type { QueryEngineConfig } from './orchestrator/QueryEngine'
import { newId } from '../store/id'
import { validateProfile } from './profile/AgentProfile'
import type { AgentTask } from '../../shared/types/AgentTask'
import type { SessionEvent, SessionEventPayloadMap } from '../../shared/types/SessionEvent'
import type { AgentProfile } from './profile/AgentProfile'

const MAX_TASKS = 500

export interface CreateTaskParams {
  sessionId: string
  goal: string
  projectId?: string
  modelConfigId?: string
  modelName?: string
  language?: string
  profile?: AgentProfile
  /** Override QueryEngine config for this session (used on first task). */
  engineConfig?: Partial<QueryEngineConfig>
  /** Execution mode. 'coordinator' activates multi-agent orchestration. */
  mode?: 'normal' | 'coordinator'
}

export class AgentRuntime {
  private tasks = new Map<string, AgentTask>()
  /** Session-level QueryEngine tracking (one per session for conversation continuity). */
  private sessionEngines = new Map<string, QueryEngine>()

  /** Create and start a new agent task */
  createTask(params: CreateTaskParams): AgentTask {
    const { sessionId, goal, projectId, modelConfigId, modelName, language, profile, engineConfig, mode } = params

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

    // UserMessage is emitted by QueryEngine.submitMessage() — don't duplicate here

    // Start execution via QueryEngine
    this.runTask(task, profile, { ...engineConfig, language }, mode).catch((err) => {
      console.error(`[AgentRuntime] task ${id} failed:`, err)
    })

    return task
  }

  /** Cancel a running task */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false

    // Interrupt QueryEngine if active for this session
    const engine = this.sessionEngines.get(task.sessionId)
    if (engine) {
      engine.interrupt()
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

  /** Get (or create) the QueryEngine for a session. */
  getEngine(sessionId: string): QueryEngine | undefined {
    return this.sessionEngines.get(sessionId)
  }

  /** Shut down a session's QueryEngine and clean up. */
  closeSession(sessionId: string): void {
    const engine = this.sessionEngines.get(sessionId)
    if (engine) {
      engine.interrupt()
      this.sessionEngines.delete(sessionId)
    }
    removeQueryEngine(sessionId)
  }

  // ── Private ──

  private async runTask(
    task: AgentTask,
    profile?: AgentProfile,
    engineConfig?: Partial<QueryEngineConfig>,
    mode?: 'normal' | 'coordinator',
  ): Promise<void> {
    const effectiveProfile = profile || (mode === 'coordinator' ? getCoordinatorProfile() : getDefaultProfile())

    const engine = this.getOrCreateEngine(task.sessionId, task.projectId, engineConfig, mode)
    this.sessionEngines.set(task.sessionId, engine)

    task.status = 'executing'
    task.updatedAt = Date.now()

    try {
      for await (const event of engine.submitMessage(task.goal, task, effectiveProfile)) {
        agentEventBus.emit(event)
      }
      if ((task.status as string) !== 'cancelled') {
        task.status = 'completed'
      }
    } catch (err) {
      if ((task.status as string) !== 'cancelled') {
        task.status = 'failed'
        task.updatedAt = Date.now()
        this.emit(task, 'TaskFailed', {
          error: err instanceof Error ? err.message : 'Unknown error',
          recoverable: true,
        })
      }
    }
  }

  private getOrCreateEngine(
    sessionId: string,
    projectId?: string,
    configOverride?: Partial<QueryEngineConfig>,
    mode?: 'normal' | 'coordinator',
  ): QueryEngine {
    // Check session-level cache first
    let engine = this.sessionEngines.get(sessionId)
    if (engine) return engine

    // Check global registry
    engine = getQueryEngine(sessionId, {
      sessionId,
      projectId,
      mode,
      ...configOverride,
    })
    return engine
  }

  // ── Event helper ──

  emit<K extends keyof SessionEventPayloadMap>(
    task: AgentTask, type: K, payload: SessionEventPayloadMap[K],
  ): void {
    agentEventBus.emit({
      id: newId(), sessionId: task.sessionId, taskId: task.id,
      type, payload, createdAt: Date.now(),
    } as SessionEvent)
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
      systemPrompt: {
        id: 'default',
        sections: [{
          name: 'identity', priority: 10,
          content: 'You are an AI agent running in AttaSeek. Use tools when needed. Be concise and helpful.',
        }],
      },
      tools: [], skills: [],
      execution: { maxTurns: 10, maxParallelTools: 1, planning: 'none' as const },
    })
  }
  return _defaultProfile
}

// ── Coordinator profile (module-level, allocated once) ──

let _coordinatorProfile: AgentProfile | null = null

function getCoordinatorProfile(): AgentProfile {
  if (!_coordinatorProfile) {
    // The coordinator profile is loaded lazily to avoid circular imports.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { coordinatorProfile } = require('./profile/profiles/coordinator-profile') as {
      coordinatorProfile: AgentProfile
    }
    _coordinatorProfile = coordinatorProfile
  }
  return _coordinatorProfile
}

export const agentRuntime = new AgentRuntime()
