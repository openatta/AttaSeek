/**
 * Audit — immutable log of agent actions, tool calls, and permission decisions.
 * Managed by AuditService in main process. Always-on by default.
 */

export type AuditEventType =
  | 'agent_task_created'
  | 'agent_task_completed'
  | 'agent_task_failed'
  | 'agent_task_cancelled'
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'permission_granted'
  | 'permission_denied'
  | 'artifact_created'
  | 'artifact_updated'
  | 'plugin_activated'
  | 'plugin_deactivated'
  | 'high_risk_action'

export interface AuditLog {
  id: string
  taskId?: string
  sessionId?: string
  projectId?: string
  eventType: AuditEventType
  toolId?: string
  riskLevel?: import('./Tool').ToolRiskLevel
  inputSummary?: string
  outputSummary?: string
  permissionResult?: 'allow' | 'deny'
  artifactRefs?: string[]
  metadata?: Record<string, unknown>
  createdAt: number
}

export interface AuditFilters {
  sessionId?: string
  taskId?: string
  projectId?: string
  eventType?: AuditEventType
  riskLevel?: import('./Tool').ToolRiskLevel
  from?: number
  to?: number
  limit?: number
  offset?: number
}
