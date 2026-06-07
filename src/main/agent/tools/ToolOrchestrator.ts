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
import { toolRegistry } from '../../tools/ToolRegistry'
import type { LLMToolUseBlock } from '../llm/ModelProvider'

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

/** Determine if a tool is read-only, checking manifest first, then name heuristic */
export function isReadOnly(name: string): boolean {
  const manifest = toolRegistry.get(name)
  if (manifest?.isReadOnly !== undefined) return manifest.isReadOnly
  // Fallback: name-based heuristic
  return /^(read|search|list|get|glob|grep|view|show|find|cite)/i.test(name)
}

/** Determine if a tool is concurrency-safe, checking manifest first */
export function isConcurrencySafe(name: string): boolean {
  const manifest = toolRegistry.get(name)
  if (manifest?.isConcurrencySafe !== undefined) return manifest.isConcurrencySafe
  // Fallback: read-only tools are concurrency-safe by default
  return isReadOnly(name)
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
    if (isConcurrencySafe(tu.name)) {
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
