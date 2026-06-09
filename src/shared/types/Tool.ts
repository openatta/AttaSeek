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
  /** Whether this tool only reads data (safe to run concurrently with other reads) */
  isReadOnly?: boolean
  /** Whether multiple instances of this tool can run concurrently.
   *  Can be a static boolean or a runtime function that inspects the input. */
  isConcurrencySafe?: boolean | ((input: unknown) => boolean)
  /** Whether this tool is deferred (loaded on-demand via ToolSearchTool).
   *  MCP tools and other dynamic tools should set this to true. */
  isDeferred?: boolean
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
