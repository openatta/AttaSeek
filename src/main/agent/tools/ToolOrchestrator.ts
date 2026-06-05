/**
 * ToolOrchestrator — Parallel tool execution dispatcher.
 *
 * Groups tool calls by risk level:
 *   'read'  → parallel execution (up to maxParallelTools)
 *   'write' / 'risky' → sequential execution (one at a time)
 *
 * Integrated into AgentOrchestrator to replace sequential for-loop.
 */

import { toolExecutor } from '../../tools/ToolExecutor'
import type { LLMToolUseBlock } from '../llm/LLMProvider'

export interface ToolExecResult {
  toolCallId: string
  toolUse: LLMToolUseBlock
  success: boolean
  output: unknown
  error?: { code: string; message: string; recoverable: boolean }
  permissionDecision?: 'allow' | 'deny'
}

export interface ToolOrchestrationResult {
  results: ToolExecResult[]
  denied: boolean
}

/** Execute a batch of tool calls with parallelism for read tools */
export async function orchestrateTools(
  toolUses: LLMToolUseBlock[],
  taskId: string,
  sessionId: string,
  projectId?: string,
  maxParallel: number = 16,
): Promise<ToolOrchestrationResult> {
  const reads: LLMToolUseBlock[] = []
  const writes: LLMToolUseBlock[] = []

  for (const tu of toolUses) {
    if (tu.name.includes('read') || tu.name.includes('search') || tu.name.includes('list') || tu.name.includes('get')) {
      reads.push(tu)
    } else {
      writes.push(tu)
    }
  }

  const results: ToolExecResult[] = []

  // Execute read tools in parallel batches
  for (let i = 0; i < reads.length; i += maxParallel) {
    const batch = reads.slice(i, i + maxParallel)
    const batchResults = await Promise.all(
      batch.map(async (tu) => {
        const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const result = await toolExecutor.execute({
          toolId: tu.name, toolCallId,
          input: (tu.input || {}) as Record<string, unknown>,
          taskId, sessionId, projectId,
        })
        return {
          toolCallId,
          toolUse: tu,
          success: result.success,
          output: result.output,
          error: result.error,
          permissionDecision: result.permissionDecision,
        } as ToolExecResult
      }),
    )
    results.push(...batchResults)

    // Stop if any batch result was denied
    if (batchResults.some(r => r.permissionDecision === 'deny')) {
      return { results, denied: true }
    }
  }

  // Execute write/risky tools sequentially
  for (const tu of writes) {
    const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const result = await toolExecutor.execute({
      toolId: tu.name, toolCallId,
      input: (tu.input || {}) as Record<string, unknown>,
      taskId, sessionId, projectId,
    })
    results.push({
      toolCallId, toolUse: tu,
      success: result.success, output: result.output,
      error: result.error,
      permissionDecision: result.permissionDecision,
    })
    if (result.permissionDecision === 'deny') {
      return { results, denied: true }
    }
  }

  return { results, denied: false }
}
