/**
 * SessionInfo — session metadata shared across main (SessionStore), preload, and renderer.
 */
export interface SessionInfo {
  id: string
  title: string
  activity: string
  projectId: string | null   // null = CHATS, non-null = project session
  createdAt: number
  updatedAt: number
}

/**
 * AgentTask — a single agent execution unit.
 * Lives in main process; renderer holds a projection via Jotai.
 */

export type AgentTaskStatus =
  | 'idle'
  | 'intake'
  | 'context_assembling'
  | 'skill_selecting'
  | 'planning'
  | 'awaiting_permission'
  | 'executing'
  | 'generating_artifact'
  | 'verifying'
  | 'writing_memory'
  | 'completed'
  | 'paused'
  | 'waiting_user_input'
  | 'failed'
  | 'cancelled'
  | 'denied'

/** Statuses where the task has definitively stopped — no further progress possible. */
export const TERMINAL_TASK_STATUSES: readonly AgentTaskStatus[] = [
  'completed', 'failed', 'cancelled', 'denied',
] as const

export interface AgentTask {
  id: string
  sessionId: string
  projectId?: string
  modelConfigId?: string
  modelName?: string
  goal: string
  domain?: string
  status: AgentTaskStatus
  constraints?: string[]
  contextRefs?: string[]
  selectedSkills?: string[]
  plan?: TaskPlan
  artifactRefs?: string[]
  auditRefs?: string[]
  errorMessage?: string
  createdAt: number
  updatedAt: number
}

export interface TaskPlan {
  steps: PlanStep[]
  reasoning: string
}

export interface PlanStep {
  id: string
  description: string
  skillId?: string
  toolIds?: string[]
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'failed'
  dependsOn?: string[]
}
