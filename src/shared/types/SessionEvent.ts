/**
 * SessionEvent — unified event stream driving Conversation, AgentPane, and ArtifactPane.
 * All agent activity flows as typed events; renderer subscribes and renders accordingly.
 */

/** Map each event type to its payload — single source of truth for the discriminated union. */
export type SessionEventPayloadMap = {
  UserMessage: UserMessagePayload
  AgentMessage: AgentMessagePayload
  AgentMessageChunk: AgentMessageChunkPayload
  PlanCreated: PlanCreatedPayload
  PlanUpdated: PlanUpdatedPayload
  ToolCallStarted: ToolCallStartedPayload
  ToolCallFinished: ToolCallFinishedPayload
  PermissionRequested: PermissionRequestedPayload
  ArtifactCreated: ArtifactCreatedPayload
  ArtifactUpdated: ArtifactUpdatedPayload
  TaskPaused: TaskPausedPayload
  TaskCompleted: TaskCompletedPayload
  TaskFailed: TaskFailedPayload
  SystemNotification: SystemNotificationPayload
  SessionTitleGenerated: SessionTitleGeneratedPayload
  CompactBoundary: CompactBoundaryPayload
}

/** Discriminated union — `event.type` narrows `event.payload` without casts. */
export type SessionEvent = {
  [K in keyof SessionEventPayloadMap]: {
    id: string
    sessionId: string
    taskId: string
    type: K
    payload: SessionEventPayloadMap[K]
    createdAt: number
  }
}[keyof SessionEventPayloadMap]

/** Derived convenience aliases (backward-compatible with existing union-typed code). */
export type SessionEventType = keyof SessionEventPayloadMap
export type SessionEventPayload = SessionEventPayloadMap[SessionEventType]

export interface UserMessagePayload {
  content: string
  attachments?: string[]
}

export interface AgentMessagePayload {
  content: string
  reasoning?: string
}

export interface AgentMessageChunkPayload {
  content: string
  isFinal: boolean
  messageId: string
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
  artifactCount?: number
  toolCallCount?: number
  duration?: number
}

export interface CompactBoundaryPayload {
  summary: string
  tokenSaved: number
  compactedMessageCount: number
}

export interface TaskFailedPayload {
  error: string
  recoverable: boolean
}

export interface SystemNotificationPayload {
  kind: 'no_model' | 'info' | 'warning'
  message: string
}

export interface SessionTitleGeneratedPayload {
  title: string
}
