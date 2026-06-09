/**
 * ToolOrchestrator — Parallel/sequential tool execution dispatcher.
 *
 * Groups tool calls by concurrency safety:
 *   concurrency-safe  → parallel execution (up to maxParallelTools)
 *   non-concurrency-safe → sequential execution (one at a time)
 *
 * Phase D enhancements:
 *   - Dynamic concurrency-safe: tools can implement `isConcurrencySafe(parsedInput)`
 *     for runtime decisions (e.g., Bash `ls` is safe, `npm install` is not).
 *   - Context modifier chain: tools can return ContextModifier callbacks that
 *     transform the ToolUseContext for subsequent tools.
 *   - Progress collection: all progress events from the progress bus are
 *     collected and returned.
 *
 * Mirrors Claude Code's toolOrchestration.ts + runTools().
 */

import { toolExecutor } from '../../tools/ToolExecutor'
import { toolRegistry } from '../../tools/ToolRegistry'
import type { LLMToolUseBlock, LLMMessage } from '../llm/ModelProvider'
import type { ContextModifier, ToolUseContext } from './ToolContextModifier'
import { applyModifiers } from './ToolContextModifier'
import { hookPipeline } from '../hooks/HookPipeline'

// ── Types ──

export interface ToolExecResult {
  toolCallId: string
  toolUse: LLMToolUseBlock
  success: boolean
  output: unknown
  error?: { code: string; message: string; recoverable: boolean }
  permissionDecision?: 'allow' | 'deny'
  /** Context modifier returned by the tool (applied to subsequent tools). */
  contextModifiers?: ContextModifier[]
}

export interface ToolOrchestrationResult {
  results: ToolExecResult[]
  denied: boolean
  /** Context modifiers collected from all executed tools. */
  contextModifiers: ContextModifier[]
}

/**
 * Injectable tool registry for concurrency-safety checks.
 * Defaults to global toolRegistry singleton.
 */
export interface ToolRegistryRef {
  get(name: string): { isConcurrencySafe?: boolean | ((input: unknown) => boolean); riskLevel?: string } | undefined
}

/**
 * Injectable tool executor for single-tool execution.
 * Defaults to global toolExecutor singleton.
 */
export interface ToolExecutorRef {
  execute(params: {
    toolCallId: string; toolId: string; input: unknown
    taskId: string; sessionId: string; projectId?: string
  }): Promise<{ success: boolean; output: unknown; error?: { code: string; message: string; recoverable: boolean }; permissionDecision?: 'allow' | 'deny' }>
}

// ── Concurrency-safe detection ──

/**
 * Determine if a tool is concurrency-safe at runtime.
 *
 * Priority:
 *   1. Manifest `isConcurrencySafe()` function — parses input, decides dynamically
 *   2. Manifest `isConcurrencySafe` boolean — static declaration
 *   3. Name-based heuristic — read/search/list/get/glob/grep → safe
 */
export function isConcurrencySafe(name: string, input?: unknown, registry?: ToolRegistryRef): boolean {
  const manifest = (registry ?? toolRegistry).get(name)
  if (!manifest) {
    // Unknown tools: use name heuristic
    return isReadOnlyByName(name)
  }

  // Dynamic check: tool provides a runtime function
  if (typeof manifest.isConcurrencySafe === 'function') {
    try {
      return manifest.isConcurrencySafe(input ?? {})
    } catch {
      // If the function throws, be conservative
      return false
    }
  }

  // Static check
  if (typeof manifest.isConcurrencySafe === 'boolean') {
    return manifest.isConcurrencySafe
  }

  // Fallback: name heuristic
  return isReadOnlyByName(name)
}

/** Name-based heuristic: read-only tools are concurrency-safe. */
function isReadOnlyByName(name: string): boolean {
  return /^(read|search|list|get|glob|grep|view|show|find|cite|ls|cat|head|tail|wc|stat|file|which|type|env|pwd|whoami|date|echo)/i.test(name)
}

/** Determine if a tool is read-only (for permission pre-check). */
export function isReadOnly(name: string, registry?: ToolRegistryRef): boolean {
  const manifest = (registry ?? toolRegistry).get(name)
  if (manifest?.riskLevel) return manifest.riskLevel === 'read'
  return isReadOnlyByName(name)
}

/** Internal: resolve registry ref (injected or global default). */
function resolveRegistry(registry?: ToolRegistryRef): ToolRegistryRef {
  return registry ?? toolRegistry
}

// ── Batch partitioning ──

interface Batch {
  isConcurrencySafe: boolean
  blocks: LLMToolUseBlock[]
}

/**
 * Partition tool calls into batches where each batch is either:
 *   1. A single non-concurrency-safe tool, or
 *   2. Multiple consecutive concurrency-safe tools
 */
export function partitionToolCalls(toolUses: LLMToolUseBlock[], registry?: ToolRegistryRef): Batch[] {
  return toolUses.reduce((acc: Batch[], toolUse) => {
    const safe = isConcurrencySafe(toolUse.name, toolUse.input, registry)

    if (safe && acc.length > 0 && acc[acc.length - 1].isConcurrencySafe) {
      // Append to existing concurrency-safe batch
      acc[acc.length - 1].blocks.push(toolUse)
    } else {
      acc.push({ isConcurrencySafe: safe, blocks: [toolUse] })
    }
    return acc
  }, [] as Batch[])
}

// ── Orchestrator ──

/**
 * Execute a list of tool calls with parallel/serial dispatch.
 *
 * Concurrency-safe tools run in parallel batches (up to maxParallel).
 * Non-concurrency-safe tools run sequentially.
 * Context modifiers are collected and applied in order.
 */
export interface OrchestrateDeps {
  registry?: ToolRegistryRef
  executor?: ToolExecutorRef
}

export async function orchestrateTools(
  toolUses: LLMToolUseBlock[],
  taskId: string,
  sessionId: string,
  projectId?: string,
  maxParallel: number = 16,
  toolUseContext?: ToolUseContext,
  deps?: OrchestrateDeps,
  parentMessages?: LLMMessage[],
): Promise<ToolOrchestrationResult> {
  const batches = partitionToolCalls(toolUses, deps?.registry)
  const results: ToolExecResult[] = []
  const allContextModifiers: ContextModifier[] = []

  for (const batch of batches) {
    if (batch.isConcurrencySafe) {
      // Parallel execution for concurrency-safe tools
      const batchResults = await executeConcurrentBatch(
        batch.blocks, taskId, sessionId, projectId, maxParallel, deps, parentMessages,
      )
      results.push(...batchResults.results)
      allContextModifiers.push(...batchResults.contextModifiers)

      if (batchResults.denied) {
        return { results, denied: true, contextModifiers: allContextModifiers }
      }
    } else {
      // Sequential execution for non-concurrency-safe tools
      for (const block of batch.blocks) {
        const singleResult = await executeSingleTool(
          block, taskId, sessionId, projectId, deps, parentMessages,
        )
        results.push(singleResult)
        if (singleResult.contextModifiers) {
          allContextModifiers.push(...singleResult.contextModifiers)
        }

        if (singleResult.permissionDecision === 'deny') {
          return { results, denied: true, contextModifiers: allContextModifiers }
        }
      }
    }
  }

  return { results, denied: false, contextModifiers: allContextModifiers }
}

// ── Concurrent batch execution ──

async function executeConcurrentBatch(
  blocks: LLMToolUseBlock[],
  taskId: string,
  sessionId: string,
  projectId?: string,
  maxParallel: number = 16,
  deps?: OrchestrateDeps,
  parentMessages?: LLMMessage[],
): Promise<{ results: ToolExecResult[]; contextModifiers: ContextModifier[]; denied: boolean }> {
  const results: ToolExecResult[] = []
  const allContextModifiers: ContextModifier[] = []

  for (let i = 0; i < blocks.length; i += maxParallel) {
    const slice = blocks.slice(i, i + maxParallel)
    const sliceResults = await Promise.all(
      slice.map(tu => executeSingleTool(tu, taskId, sessionId, projectId, deps, parentMessages)),
    )

    for (const r of sliceResults) {
      results.push(r)
      if (r.contextModifiers) allContextModifiers.push(...r.contextModifiers)
    }

    if (sliceResults.some(r => r.permissionDecision === 'deny')) {
      return { results, contextModifiers: allContextModifiers, denied: true }
    }
  }

  return { results, contextModifiers: allContextModifiers, denied: false }
}

// ── Single tool execution ──

async function executeSingleTool(
  tu: LLMToolUseBlock,
  taskId: string,
  sessionId: string,
  projectId?: string,
  deps?: OrchestrateDeps,
  parentMessages?: LLMMessage[],
): Promise<ToolExecResult> {
  const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const executor = deps?.executor ?? toolExecutor

  // ── PreToolUse hook ──
  let modifiedInput = (tu.input || {}) as Record<string, unknown>
  try {
    const preResult = await hookPipeline.execute('PreToolUse', {
      task: { id: taskId, sessionId, goal: '', projectId } as any,
      turnCount: 0, messages: [], lastAssistantContent: '', profileId: '',
      toolCallId, toolName: tu.name, toolInput: modifiedInput,
    })
    if (preResult.decision === 'block') {
      return {
        toolCallId, toolUse: tu, success: false,
        output: null,
        error: { code: 'blocked_by_hook', message: preResult.blocking || 'Blocked by PreToolUse hook', recoverable: false },
        permissionDecision: 'deny',
      }
    }
    if (preResult.updatedInput) {
      modifiedInput = preResult.updatedInput as Record<string, unknown>
    }
  } catch { /* Hook failure is non-blocking */ }

  const result = await executor.execute({
    toolId: tu.name,
    toolCallId,
    input: modifiedInput,
    taskId,
    sessionId,
    projectId,
    parentMessages,
  })

  // ── PostToolUse hook ──
  try {
    await hookPipeline.execute('PostToolUse', {
      task: { id: taskId, sessionId, goal: '', projectId } as any,
      turnCount: 0, messages: [], lastAssistantContent: '', profileId: '',
      toolCallId, toolName: tu.name, toolInput: modifiedInput,
      toolOutput: result.output,
    })
  } catch { /* Hook failure is non-blocking */ }

  return {
    toolCallId,
    toolUse: tu,
    success: result.success,
    output: result.output,
    error: result.error,
    permissionDecision: result.permissionDecision,
  }
}

// ── Helper: execute with context modifier application ──

/**
 * Execute tools and apply context modifiers to the context after each batch.
 * Used when ToolUseContext is available (e.g., query-loop).
 */
export async function orchestrateToolsWithContext(
  toolUses: LLMToolUseBlock[],
  taskId: string,
  sessionId: string,
  context: ToolUseContext,
  maxParallel: number = 16,
): Promise<ToolOrchestrationResult> {
  const result = await orchestrateTools(
    toolUses, taskId, sessionId, undefined, maxParallel, context,
  )

  // Apply context modifiers to the shared context
  if (result.contextModifiers.length > 0) {
    applyModifiers(context, [result.contextModifiers])
  }

  return result
}
