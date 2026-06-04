/**
 * AgentRuntime — mock implementation of the AgentTask state machine.
 * Drives task lifecycle through a transition table and emits events via AgentEventBus.
 */

import { agentEventBus } from './AgentEventBus'
import { artifactService } from '../artifacts/ArtifactService'
import { memoryService } from '../memory/MemoryService'
import { auditService } from '../audit/AuditService'
import type { AgentTask, AgentTaskStatus } from '../../renderer/core/types/AgentTask'
import type { SessionEvent } from '../../renderer/core/types/SessionEvent'

type Transition = {
  from: AgentTaskStatus
  to: AgentTaskStatus
  delay: number
  effect?: (task: AgentTask, rt: AgentRuntime) => void
}

const TRANSITIONS: Transition[] = [
  { from: 'idle', to: 'intake', delay: 800, effect: (t, rt) => rt.emit(t, 'AgentMessage', { content: 'I understand your goal.' }) },
  { from: 'intake', to: 'context_assembling', delay: 500 },
  { from: 'context_assembling', to: 'skill_selecting', delay: 300, effect: (t) => { t.selectedSkills = ['generate_doc', 'summarize'] } },
  { from: 'skill_selecting', to: 'planning', delay: 600, effect: (t, rt) => {
    t.plan = {
      steps: [
        { id: 'step_1', description: 'Analyze the request', status: 'completed', toolIds: [] },
        { id: 'step_2', description: 'Generate content', status: 'active', toolIds: ['create_document'] },
        { id: 'step_3', description: 'Verify result', status: 'pending', toolIds: [] },
      ],
      reasoning: 'Simple document generation workflow',
    }
    rt.emit(t, 'PlanCreated', { plan: t.plan })
  }},
  { from: 'planning', to: 'executing', delay: 700, effect: (t, rt) => {
    rt.emit(t, 'ToolCallStarted', { toolCallId: `tc_rf`, toolId: 'read_file', toolName: 'read_file', input: {}, riskLevel: 'read' })
    setTimeout(() => rt.emit(t, 'ToolCallFinished', { toolCallId: `tc_rf`, toolId: 'read_file', toolName: 'read_file', output: {}, status: 'success', duration: 400 }), 400)
    setTimeout(() => {
      rt.emit(t, 'ToolCallStarted', { toolCallId: `tc_cd`, toolId: 'create_document', toolName: 'create_document', input: {}, riskLevel: 'write' })
      setTimeout(() => rt.emit(t, 'ToolCallFinished', { toolCallId: `tc_cd`, toolId: 'create_document', toolName: 'create_document', output: {}, status: 'success', duration: 500 }), 500)
    }, 500)
  }},
  { from: 'executing', to: 'generating_artifact', delay: 600, effect: (t, rt) => {
    const artifact = artifactService.create({ sessionId: t.sessionId, taskId: t.id, type: 'markdown', title: 'Report', content: `# ${t.goal}\n\nMock report.` })
    t.artifactRefs = [artifact.id]
    rt.emit(t, 'ArtifactCreated', { artifactId: artifact.id, type: 'markdown', title: artifact.title, summary: t.goal })
  }},
  { from: 'generating_artifact', to: 'verifying', delay: 200 },
  { from: 'verifying', to: 'writing_memory', delay: 200, effect: (t) => {
    memoryService.store({ layer: 'L2', scope: 'project', scopeId: t.projectId || t.sessionId, type: 'task_state', content: `Completed: ${t.goal}`, source: `task:${t.id}`, sessionId: t.sessionId, taskId: t.id })
  }},
  { from: 'writing_memory', to: 'completed', delay: 200, effect: (t, rt) => {
    rt.emit(t, 'TaskCompleted', { summary: `Completed: ${t.goal}`, artifactCount: t.artifactRefs?.length || 0, toolCallCount: 2, duration: Date.now() - t.createdAt })
    auditService.log({ taskId: t.id, sessionId: t.sessionId, projectId: t.projectId, eventType: 'agent_task_completed' })
  }},
]

export class AgentRuntime {
  private tasks = new Map<string, AgentTask>()
  private timers = new Map<string, NodeJS.Timeout>()
  private nextId = 1
  private transitionMap: Map<AgentTaskStatus, Transition>

  constructor() {
    this.transitionMap = new Map(TRANSITIONS.map((tr) => [tr.from, tr]))
  }

  createTask(sessionId: string, goal: string, projectId?: string): AgentTask {
    const id = `task_${this.nextId++}`
    const task: AgentTask = { id, sessionId, projectId, goal, status: 'idle', createdAt: Date.now(), updatedAt: Date.now() }
    this.tasks.set(id, task)
    this.emit(task, 'UserMessage', { content: goal })
    this.advanceTask(task)
    return task
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false
    const timer = this.timers.get(taskId)
    if (timer) { clearTimeout(timer); this.timers.delete(taskId) }
    task.status = 'cancelled'
    task.updatedAt = Date.now()
    this.emit(task, 'TaskFailed', { error: 'Task cancelled by user', recoverable: false })
    return true
  }

  getTask(taskId: string): AgentTask | undefined { return this.tasks.get(taskId) }

  private advanceTask(task: AgentTask): void {
    const transition = this.transitionMap.get(task.status)
    if (!transition) return
    task.status = transition.to
    task.updatedAt = Date.now()
    transition.effect?.(task, this)
    const timer = setTimeout(() => this.advanceTask(task), transition.delay)
    this.timers.set(task.id, timer)
  }

  // --- event helper ---
  emit(task: AgentTask, type: SessionEvent['type'], payload: SessionEvent['payload']): void {
    agentEventBus.emit({ id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, sessionId: task.sessionId, taskId: task.id, type, payload, createdAt: Date.now() })
  }
}

export const agentRuntime = new AgentRuntime()
