/**
 * SessionEvent — unified event stream driving Conversation, AgentPane, and ArtifactPane.
 * All agent activity flows as typed events; renderer subscribes and renders accordingly.
 */

export type SessionEventType =
  | 'UserMessage'
  | 'AgentMessage'
  | 'PlanCreated'
  | 'PlanUpdated'
  | 'ToolCallStarted'
  | 'ToolCallFinished'
  | 'PermissionRequested'
  | 'ArtifactCreated'
  | 'ArtifactUpdated'
  | 'TaskPaused'
  | 'TaskCompleted'
  | 'TaskFailed'

export interface SessionEvent {
  id: string
  sessionId: string
  taskId: string
  type: SessionEventType
  payload: SessionEventPayload
  createdAt: number
}

export type SessionEventPayload =
  | UserMessagePayload
  | AgentMessagePayload
  | PlanCreatedPayload
  | PlanUpdatedPayload
  | ToolCallStartedPayload
  | ToolCallFinishedPayload
  | PermissionRequestedPayload
  | ArtifactCreatedPayload
  | ArtifactUpdatedPayload
  | TaskPausedPayload
  | TaskCompletedPayload
  | TaskFailedPayload

export interface UserMessagePayload {
  content: string
  attachments?: string[]
}

export interface AgentMessagePayload {
  content: string
  reasoning?: string
}

export interface PlanCreatedPayload {
  plan: import('./AgentTask').TaskPlan
}

export interface PlanUpdatedPayload {
  plan: import('./AgentTask').TaskPlan
  changedSteps: string[]
}

export interface ToolCallStartedPayload {
  toolCallId: string
  toolId: string
  toolName: string
  input: unknown
  riskLevel: import('./Tool').ToolRiskLevel
}

export interface ToolCallFinishedPayload {
  toolCallId: string
  toolId: string
  toolName: string
  output: unknown
  status: 'success' | 'error'
  error?: string
  duration: number
}

export interface PermissionRequestedPayload {
  permissionRequestId: string
  toolCallId: string
  toolId: string
  toolName: string
  riskLevel: import('./Tool').ToolRiskLevel
  action: string
  preview: string
  impact: string
  rollbackable: boolean
}

export interface ArtifactCreatedPayload {
  artifactId: string
  type: import('./Artifact').ArtifactType
  title: string
  summary: string
}

export interface ArtifactUpdatedPayload {
  artifactId: string
  version: number
  summary: string
}

export interface TaskPausedPayload {
  reason: string
}

export interface TaskCompletedPayload {
  summary: string
  artifactCount: number
  toolCallCount: number
  duration: number
}

export interface TaskFailedPayload {
  error: string
  recoverable: boolean
}
