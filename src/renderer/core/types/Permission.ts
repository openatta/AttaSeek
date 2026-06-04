/**
 * Permission — unified permission model for tools, plugins, projects, and sessions.
 * Managed by PermissionService in main process.
 */

export type PermissionDecision = 'allow' | 'ask' | 'deny'

export interface PermissionRequest {
  id: string
  taskId: string
  toolCallId: string
  toolId: string
  toolName: string
  riskLevel: import('./Tool').ToolRiskLevel
  action: string
  preview: string
  impact: string
  rollbackable: boolean
  status: 'pending' | 'allowed' | 'denied'
  createdAt: number
  resolvedAt?: number
}

export interface PermissionPolicy {
  id: string
  scope: PermissionScope
  scopeId: string
  toolId?: string
  pluginId?: string
  riskLevel?: import('./Tool').ToolRiskLevel
  decision: PermissionDecision
  createdAt: number
  updatedAt: number
}

export type PermissionScope = 'tool' | 'plugin' | 'project' | 'session' | 'risk_level' | 'global'

export interface PermissionContext {
  toolId: string
  pluginId: string
  projectId?: string
  sessionId: string
  riskLevel: import('./Tool').ToolRiskLevel
  action: string
}
