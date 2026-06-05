/**
 * ToolExecutor — unified tool execution pipeline.
 *
 * Flow: ToolCall → PermissionService.check() → [PermissionBridge if 'ask'] → Execute → AuditService.log()
 *
 * Every tool execution is recorded in the audit log.
 * High-risk tools must pass permission gate before execution.
 */

import { toolRegistry } from './ToolRegistry'
import { permissionService } from '../permission/PermissionService'
import { auditService } from '../audit/AuditService'
import { permissionBridge } from '../permission/PermissionBridge'
import { agentEventBus } from '../agent/AgentEventBus'
import { newId } from '../store/id'
import { TOOL_IMPLS, type ToolImpl } from './ToolImplementations'
import type { ToolRiskLevel } from '../../renderer/core/types/Tool'

// ── Types ──

export interface ToolExecParams {
  toolId: string
  toolCallId: string
  input: Record<string, unknown>
  taskId: string
  sessionId: string
  projectId?: string
}

export interface ToolExecResult {
  success: boolean
  output?: unknown
  error?: ToolError
  permissionDecision?: 'allow' | 'deny'
}

export interface ToolError {
  code: string
  message: string
  recoverable: boolean
}

// ── Executor ──

export class ToolExecutor {
  /** Execute a tool call through the full permission → execute → audit pipeline */
  async execute(params: ToolExecParams): Promise<ToolExecResult> {
    const { toolId, toolCallId, input, taskId, sessionId, projectId } = params
    const startTime = Date.now()

    // 1. Look up tool manifest
    const manifest = toolRegistry.get(toolId)
    if (!manifest) {
      return {
        success: false,
        output: `Tool not found: ${toolId}`,
        error: { code: 'TOOL_NOT_FOUND', message: `Tool not found: ${toolId}`, recoverable: false },
      }
    }

    // 2. Permission check
    const decision = permissionService.check({
      toolId,
      pluginId: manifest.pluginId,
      projectId,
      sessionId,
      riskLevel: manifest.riskLevel,
      action: `Execute ${manifest.name} with ${JSON.stringify(input).slice(0, 200)}`,
    })

    if (decision === 'deny') {
      auditService.log({
        taskId, sessionId, projectId,
        eventType: 'permission_denied',
        toolId, riskLevel: manifest.riskLevel,
        inputSummary: JSON.stringify(input).slice(0, 500),
      })
      return { success: false, output: `Permission denied: ${toolId}`, error: { code: 'PERMISSION_DENIED', message: `Tool ${toolId} is denied by policy`, recoverable: false }, permissionDecision: 'deny' }
    }

    if (decision === 'ask') {
      // Emit permission request event and wait for user response
      const permReq = permissionService.requestPermission(
        taskId, toolCallId, toolId, manifest.name,
        manifest.riskLevel,
        `Execute ${manifest.name}`,
        JSON.stringify(input).slice(0, 1000),
        manifest.riskLevel === 'risky' ? 'This action cannot be undone' : 'This action can be reviewed',
        manifest.riskLevel !== 'risky',
      )

      agentEventBus.emit({
        id: newId(), sessionId, taskId,
        type: 'PermissionRequested',
        payload: {
          permissionRequestId: permReq.id,
          toolCallId, toolId, toolName: manifest.name,
          riskLevel: manifest.riskLevel,
          action: `Execute ${manifest.name}`,
          preview: JSON.stringify(input).slice(0, 1000),
          impact: manifest.riskLevel === 'risky' ? 'Cannot be undone' : 'Can be reviewed',
          rollbackable: manifest.riskLevel !== 'risky',
        },
        createdAt: Date.now(),
      })

      const userDecision = await permissionBridge.awaitPermission(permReq.id)
      if (userDecision === 'deny') {
        auditService.log({
          taskId, sessionId, projectId,
          eventType: 'permission_denied',
          toolId, riskLevel: manifest.riskLevel,
          inputSummary: JSON.stringify(input).slice(0, 500),
          permissionResult: 'deny',
        })
        return { success: false, output: 'User denied the tool execution', error: { code: 'USER_DENIED', message: 'User denied the tool execution', recoverable: false }, permissionDecision: 'deny' }
      }
    }

    // 3. Log tool call started
    auditService.log({
      taskId, sessionId, projectId,
      eventType: 'tool_call_started',
      toolId, riskLevel: manifest.riskLevel,
      inputSummary: JSON.stringify(input).slice(0, 500),
    })

    // 4. Execute tool implementation
    const impl: ToolImpl | undefined = TOOL_IMPLS[toolId]
    if (!impl) {
      const duration = Date.now() - startTime
      auditService.log({
        taskId, sessionId, projectId,
        eventType: 'tool_call_completed',
        toolId, riskLevel: manifest.riskLevel,
        outputSummary: `Error: No implementation for tool ${toolId}`,
      })
      return {
        success: false,
        output: `No implementation for tool: ${toolId}`,
        error: { code: 'NO_IMPL', message: `No implementation for tool: ${toolId}`, recoverable: false },
      }
    }

    try {
      const output = await impl(input)
      const duration = Date.now() - startTime

      // 5. Log success
      auditService.log({
        taskId, sessionId, projectId,
        eventType: 'tool_call_completed',
        toolId, riskLevel: manifest.riskLevel,
        inputSummary: JSON.stringify(input).slice(0, 500),
        outputSummary: JSON.stringify(output).slice(0, 500),
      })

      // Ensure output is always a string (LLM needs string content)
      const safeOutput = typeof output === 'string' ? output : JSON.stringify(output)
      return { success: true, output: safeOutput, permissionDecision: decision === 'ask' ? 'allow' : undefined }
    } catch (err) {
      const duration = Date.now() - startTime
      const message = err instanceof Error ? err.message : 'Unknown error'

      auditService.log({
        taskId, sessionId, projectId,
        eventType: 'tool_call_completed',
        toolId, riskLevel: manifest.riskLevel,
        inputSummary: JSON.stringify(input).slice(0, 500),
        outputSummary: `Error: ${message}`,
      })

      // Determine if recoverable — check both error code and message
      const recoverable = !(
        (err as any)?.code && ['ENOENT', 'EACCES', 'EPERM'].includes((err as any).code)
      ) && !['permission denied', 'access denied'].some((c) => message.toLowerCase().includes(c))

      return {
        success: false,
        output: `Error: ${message}`,
        error: { code: 'EXECUTION_ERROR', message, recoverable },
      }
    }
  }
}

/** Singleton */
export const toolExecutor = new ToolExecutor()
