/**
 * Tool — agent boundary to external capabilities and data sources.
 * Managed by ToolRegistry / ToolRouter / ToolExecutor in main process.
 */

export type ToolRiskLevel = 'read' | 'write' | 'risky'

export type ToolCategory = 'filesystem' | 'network' | 'database' | 'code' | 'communication' | 'automation' | 'plugin' | 'research' | 'lsp' | 'notification'

export interface ToolManifest {
  id: string
  pluginId: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  riskLevel: ToolRiskLevel
  category: ToolCategory
  permissionPolicy: ToolPermissionPolicy
}

export interface ToolPermissionPolicy {
  default: 'allow' | 'ask' | 'deny'
  requirePreview: boolean
  allowAlways: boolean
}

export interface ToolCall {
  id: string
  taskId: string
  toolId: string
  status: 'pending' | 'running' | 'completed' | 'error' | 'denied'
  inputSummary: string
  outputSummary?: string
  riskLevel: ToolRiskLevel
  createdAt: number
  completedAt?: number
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: ToolError
  duration: number
}

export interface ToolError {
  code: string
  message: string
  recoverable: boolean
}
