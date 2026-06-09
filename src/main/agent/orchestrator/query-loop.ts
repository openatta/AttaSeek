/**
 * query-loop — inner pure AsyncGenerator for the agent execution pipeline.
 *
 * Mirrors Claude Code's queryLoop() (src/query.ts). Accepts immutable params
 * and a DI container (QueryLoopDeps). All side effects flow through deps —
 * no direct imports of singletons.
 *
 * Pipeline (each iteration):
 *   1. Compaction warning check   — emit heads-up if budget approaching trigger ratio
 *   2. Compaction pipeline         — 5-stage: Snip → Microcompact(content+time) → Collapse → Auto-compact
 *   3. Token budget evaluation     — check remaining budget, emit meta continue
 *   4. LLM Call (with fallback)    — deps.callModel(params, onChunk), streaming
 *   5. Post-sampling hooks         — HookManager
 *   6. Stop hooks                  — HookPipeline
 *   7. Tool Execution              — run tools, append results, continue if tool_use
 *   8. Tool use summary            — generate heuristic summary, inject before next turn
 * → Terminal                       — return why the loop stopped
 *
 * Phase C: Full compaction chain (snip/microcompact/collapse) + token budget.
 * Phase D: Full ToolUseContext wired.
 * Phase E: CompactionPipeline integration — full 5-stage pipeline wired into loop.
 */

import { agentEventBus } from '../AgentEventBus'
import { newId } from '../../store/id'
import { createSessionEvent } from '../events'
import { StreamingToolExecutor } from '../tools/StreamingToolExecutor'
import { orchestrateTools } from '../tools/ToolOrchestrator'
import { microcompact, compactConversation } from '../compact/ContextCompactor' // keep for backward compat + default deps
import { runCompactionPipeline, createPipelineTracking, runReactiveCompaction } from '../compact/CompactionPipeline'
import type { PipelineTracking } from '../compact/CompactionPipeline'
import { shouldEmitCompactWarning, suppressCompactWarning, clearCompactWarningSuppression } from '../compact/CompactWarningState'
import { CollapseManager } from '../compact/CollapseManager'
import { estimateMessagesTokens } from '../compact/token-counter'
import { applyToolResultBudget } from '../compact/ToolResultBudget'
import { hookManager } from '../hooks/HookManager'
import { hookPipeline } from '../hooks/HookPipeline'
import { modelProviderRegistry } from '../llm/ModelProviderRegistry'
import { costTracker } from '../llm/cost-tracker'
import { ModelResolver } from '../llm/ModelResolver'
import { loadLLMConfig } from '../llm/AttaSettingsLoader'
import { TelemetryService } from '../telemetry/TelemetryService'
import type { TelemetryEventType } from '../telemetry/TelemetryService'
import { queryCheckpoint, logQueryProfileReport } from '../telemetry/QueryProfiler'
import { createInitialState, withTransition } from './AgentState'
import { routeError, createRecoveryState, escalateMaxOutputTokens, MAX_OUTPUT_RECOVERY_ATTEMPTS } from './recovery-router'
import { TokenBudgetTracker } from './token-budget'
import { generateToolUseSummary, generateLLMToolUseSummary, buildToolUseSummaryMessage } from './tool-summary'
import type { AgentState } from './AgentState'
import type { AgentTask } from '../../../shared/types/AgentTask'
import type { AgentProfile } from '../profile/AgentProfile'
import type { SessionEvent } from '../../../shared/types/SessionEvent'
import type { LLMMessage, LLMContentBlock, LLMToolUseBlock, LLMChatResult, LLMToolDef } from '../llm/ModelProvider'
import type { TerminalReason, ContinueReason } from './transitions'
import type {
  CallModelParams, CallModelResult, CallModelChunkCallback,
  MicrocompactResult,
} from './QueryDeps'
import { validateAndRepairToolPairing, buildToolResultBlock } from './tool-pairing'
import {
  ID_PREFIX_LENGTH,
  TOOL_RESULT_TRUNCATE_LIMIT,
  COMPACT_WARNING_TRIGGER_RATIO,
} from '../../../shared/constants'
import {
  STRUCTURED_OUTPUT_TOOL_NAME,
  MAX_STRUCTURED_OUTPUT_RETRIES,
  buildStructuredOutputToolDef,
  executeStructuredOutput,
} from '../tools/implementations/structured-output'
import {
  isContextLengthError,
  isMediaSizeError,
  tryReactiveCompact,
} from '../compact/ReactiveCompactor'
import { feature } from '../features/FeatureFlags'

// ── Token budget constant ──

const DEFAULT_TOKEN_BUDGET = 200_000

// ── Params (immutable, per-query-loop invocation) ──

/**
 * QueryLoopParams — immutable per-execution inputs.
 *
 * @alias AgentExecutionParams — preferred name for external consumers.
 */
export interface QueryLoopParams {
  task: AgentTask
  profile: AgentProfile
  /** Pre-assembled messages (by ContextAssembler) */
  messages: LLMMessage[]
  /** Pre-rendered system prompt */
  systemPrompt: string
  /** Pre-selected tool definitions */
  tools: LLMToolDef[]
  /** Abort signal for cancellation */
  signal: AbortSignal
  /** Which model slot to use for LLM calls */
  modelSlot: 'main' | 'subagent'
  /** Optional token budget override (default 200K) */
  tokenBudget?: number
  /** Optional USD cost budget cap. Query loop terminates when total cost exceeds this. */
  maxBudgetUsd?: number
  /** Optional JSON schema for structured output enforcement. */
  jsonSchema?: Record<string, unknown>
}

// ── Deps (DI, all side effects) ──

/**
 * QueryLoopDeps — DI container for the query loop's side effects.
 *
 * @alias AgentExecutionDeps — preferred name for external consumers.
 */
export interface QueryLoopDeps {
  /** Call the LLM provider with streaming. */
  callModel: (params: CallModelParams, onChunk: CallModelChunkCallback) => Promise<CallModelResult>
  /** Microcompact — per-turn tool result trimming. */
  microcompact: (messages: LLMMessage[], querySource: string) => Promise<MicrocompactResult>
  /** Generate a UUID v4 (injected for deterministic testing). */
  uuid: () => string
  /** Optional: autocompact — full Phase C replaces this with pipelined version. */
  autocompact?: (messages: LLMMessage[], profile: AgentProfile, existingSummary?: string) => Promise<{
    messages: LLMMessage[]
    summary: string
    tokensFreed: number
    compressedCount: number
  }>
  /** Optional: run tools — injected so tests can fake tool execution. */
  runTools?: typeof orchestrateTools
  /** Optional: route errors — injected so tests can fake recovery routing. */
  routeError?: typeof routeError
  /** Optional: emit events — injected so tests can capture/fake event emission. */
  emitEvent?: typeof agentEventBus.emit
  /** Optional: flush async events — injected so tests can control flush timing. */
  flushEvents?: () => Promise<void>
  /** Optional: execute post-sampling hooks. */
  executeHooks?: typeof hookManager.execute
  /** Optional: execute stop hooks. */
  executeStopHooks?: typeof hookPipeline.execute
  /** Optional: resolve model for a slot (main/subagent/compact/fallback). */
  resolveModel?: (providerId: string | undefined, slot: string) => ModelResolver | null
  /** Optional: get feature flag value. */
  isFeatureEnabled?: (name: string) => boolean
  /** Optional: estimate tokens for a message array. */
  estimateTokens?: (messages: LLMMessage[]) => number
  /** Optional: create a collapse manager instance. */
  createCollapseManager?: () => CollapseManager
  /** Optional: create a telemetry instance for this execution. */
  createTelemetry?: (sessionId: string, taskId: string, depth: number) => TelemetryService
  /** Optional: run the full compaction pipeline. */
  runCompaction?: typeof runCompactionPipeline
  /** Optional: create fresh pipeline tracking state. */
  createPipelineTracking?: typeof createPipelineTracking
  /** Optional: check if compact warning should be emitted. */
  shouldWarnCompact?: typeof shouldEmitCompactWarning
  /** Optional: suppress compact warning state. */
  suppressCompactWarning?: typeof suppressCompactWarning
  /** Optional: clear compact warning suppression. */
  clearCompactWarningSuppression?: typeof clearCompactWarningSuppression
  /** Optional: create a streaming tool executor. */
  createStreamingExecutor?: (taskId: string, sessionId: string, projectId?: string) => StreamingToolExecutor
  /** Optional: compact/small model name for tool summaries and memory extraction. */
  compactModel?: string
  /** Optional: create an async memory prefetch (fire-and-forget, consumed after tools). */
  createMemoryPrefetch?: (sessionId: string, projectId?: string, goal?: string) => Promise<LLMMessage[]>
}

// ── Default production deps ──

/** Wire real implementations (uses current singletons — will be replaced by full QueryDeps in Phase C/D). */
export function productionLoopDeps(): QueryLoopDeps {
  return {
    callModel: defaultCallModel,
    microcompact: defaultMicrocompact,
    uuid: () => newId(),
    autocompact: defaultAutocompact,
    runTools: orchestrateTools,
    routeError,
    emitEvent: agentEventBus.emit.bind(agentEventBus),
    flushEvents: () => agentEventBus.flushAsyncIfNeeded(),
    executeHooks: hookManager.execute.bind(hookManager),
    executeStopHooks: hookPipeline.execute.bind(hookPipeline),
    resolveModel: (providerId, _slot) => {
      const config = loadLLMConfig(providerId ?? undefined)
      return config.provider ? new ModelResolver(config.provider) : null
    },
    isFeatureEnabled: (name) => feature(name as any),
    estimateTokens: (messages) => estimateMessagesTokens(messages),
    createCollapseManager: () => new CollapseManager(),
    createTelemetry: (sessionId, taskId, depth) => new TelemetryService(sessionId, taskId, depth),
    runCompaction: runCompactionPipeline,
    createPipelineTracking,
    shouldWarnCompact: shouldEmitCompactWarning,
    suppressCompactWarning,
    clearCompactWarningSuppression,
    createStreamingExecutor: (taskId, sessionId, projectId) => new StreamingToolExecutor(taskId, sessionId, projectId),
    createMemoryPrefetch: async (sessionId, projectId, _goal) => {
      try {
        const { startMemoryPrefetch, consumeMemoryPrefetch } = await import('../context/MemoryPrefetcher')
        const prefetch = startMemoryPrefetch({ sessionId, projectId })
        const result = await consumeMemoryPrefetch(prefetch)
        return result?.messages ?? []
      } catch { return [] }
    },
    compactModel: () => {
      try {
        const config = loadLLMConfig()
        return config.provider ? new ModelResolver(config.provider).compact() : undefined
      } catch { return undefined }
    },
  }
}

/** Default LLM caller — resolves provider from registry. */
async function defaultCallModel(
  params: CallModelParams,
  onChunk: CallModelChunkCallback,
): Promise<CallModelResult> {
  const provider = modelProviderRegistry.getDefault()
  if (!provider) throw new Error('No LLM provider configured')
  return provider.chatStream(
    {
      systemPrompt: params.systemPrompt,
      messages: params.messages,
      tools: params.tools,
      signal: params.signal,
      model: params.model,
      toolChoice: params.toolChoice,
    },
    (chunk) => {
      onChunk({
        type: chunk.type,
        text: 'text' in chunk ? chunk.text : undefined,
        id: 'id' in chunk ? chunk.id : undefined,
        name: 'name' in chunk ? chunk.name : undefined,
        input_json: 'input_json' in chunk ? chunk.input_json : undefined,
        index: 'index' in chunk ? chunk.index : undefined,
      })
    },
  )
}

/** Default microcompact — delegates to existing ContextCompactor. */
async function defaultMicrocompact(
  messages: LLMMessage[],
  _querySource: string,
): Promise<MicrocompactResult> {
  try {
    const compacted = microcompact(messages as any)
    return { messages: compacted as unknown as LLMMessage[], compactedCount: 0 }
  } catch {
    return { messages, compactedCount: 0 }
  }
}

/** Default autocompact — delegates to existing compactConversation. */
async function defaultAutocompact(
  messages: LLMMessage[],
  profile: AgentProfile,
  existingSummary?: string,
): Promise<{ messages: LLMMessage[]; summary: string; tokensFreed: number; compressedCount: number }> {
  const result = await compactConversation(messages, profile, existingSummary)
  return {
    messages: result.compactedMessages,
    summary: result.summary,
    tokensFreed: result.tokenSaved,
    compressedCount: result.compactedCount,
  }
}

// ── The query loop ──

/**
 * Inner query loop — pure AsyncGenerator.
 *
 * Accepts pre-assembled params and a DI container. All side effects
 * (LLM calls, compaction, tool execution) flow through deps.
 *
 * Yields SessionEvent for every observable state change.
 * Returns TerminalReason when the loop exits.
 */
export interface QueryLoopResult {
  reason: TerminalReason
  finalState: AgentState
  /** Structured output extracted from StructuredOutput tool calls (if jsonSchema was provided). */
  structuredOutput?: unknown
}

export async function* queryLoop(
  params: QueryLoopParams,
  deps: QueryLoopDeps = productionLoopDeps(),
): AsyncGenerator<SessionEvent, QueryLoopResult, void> {
  const { task, profile, tools } = params
  const signal = params.signal
  let state = createInitialState(task, profile)
  state.systemPrompt = params.systemPrompt
  state.messages = params.messages

  queryCheckpoint('query_loop_entry')

  // ── Resolve deps with production defaults ──
  // Each dep falls back to the direct import if not injected (100% backward compat).
  // Tests inject fakes through QueryLoopDeps; production code passes through.
  // MUST come before any feature() or estimateMessagesTokens() calls.
  const emitEvent = deps.emitEvent ?? agentEventBus.emit.bind(agentEventBus)
  const flushEvents = deps.flushEvents ?? (() => agentEventBus.flushAsyncIfNeeded())
  const executeHooks = deps.executeHooks ?? hookManager.execute.bind(hookManager)
  const executeStopHooks = deps.executeStopHooks ?? hookPipeline.execute.bind(hookPipeline)
  const isFeatureOn = deps.isFeatureEnabled ?? ((name) => feature(name as any))
  const estimateTokens = deps.estimateTokens ?? estimateMessagesTokens
  const createCollapseManager = deps.createCollapseManager ?? (() => new CollapseManager())
  const createTelemetry = deps.createTelemetry ?? ((sid, tid, d) => new TelemetryService(sid, tid, d))
  const runCompaction = deps.runCompaction ?? runCompactionPipeline
  const createTracking = deps.createPipelineTracking ?? createPipelineTracking
  const shouldWarnCompact = deps.shouldWarnCompact ?? shouldEmitCompactWarning
  const suppressWarn = deps.suppressCompactWarning ?? suppressCompactWarning
  const clearWarnSuppression = deps.clearCompactWarningSuppression ?? clearCompactWarningSuppression
  const createStreamExec = deps.createStreamingExecutor ?? ((tid, sid, pid) => new StreamingToolExecutor(tid, sid, pid))

  // ── Structured output setup ──
  const jsonSchema = params.jsonSchema
  const structuredOutputEnabled = isFeatureOn('STRUCTURED_OUTPUT') && jsonSchema !== undefined
  // Inject StructuredOutput tool if schema is provided
  const toolsForLoop = structuredOutputEnabled
    ? [...tools, buildStructuredOutputToolDef(jsonSchema!)]
    : tools
  // Count StructuredOutput tool calls across iterations (retry tracking)
  let structuredOutputCallCount = 0
  // Extracted structured output (populated when the model successfully calls the tool)
  let extractedStructuredOutput: unknown = undefined

  // ── Telemetry ──
  const telemetry = createTelemetry(task.sessionId, task.id, 0)
  const queryStartTime = Date.now()
  telemetry.emit('agent_query_started', {
    sessionId: task.sessionId,
    taskId: task.id,
    querySource: 'repl_main_thread',
    model: task.modelName || 'default',
    toolCount: tools.length,
    messageCount: params.messages.length,
    estimatedTokens: estimateTokens(params.messages),
  })

  // Determine provider for slot resolution
  const effectiveProviderId = task.modelConfigId || modelProviderRegistry.getDefaultId()
  const llmConfig = loadLLMConfig(effectiveProviderId ?? undefined)
  let slotResolver: ModelResolver | null = null
  if (llmConfig.provider) {
    slotResolver = new ModelResolver(llmConfig.provider)
  }

  // Recovery state (loop-scoped, with per-level attempt limits)
  const recovery = createRecoveryState()

  // Token budget tracker
  const budget = new TokenBudgetTracker({
    total: params.tokenBudget ?? DEFAULT_TOKEN_BUDGET,
  })

  // Initialize compaction pipeline tracking (session-scoped) into state
  state.pipelineTracking = state.pipelineTracking || createTracking()

  // Initialize collapse manager if not already present
  if (!state.collapseManager) {
    state.collapseManager = createCollapseManager()
  }

  // ── Main loop ──
  // Use <= (not <) to allow the model to consume tool results from the
  // last allowed turn — mirrors Claude Code's continue-site maxTurns check.
  while (state.turnCount <= profile.execution.maxTurns) {
    if (signal.aborted) {
      await flushEvents()
      return { reason: 'aborted', finalState: state }
    }

    // ── Async memory prefetch (fire-and-forget, consumed after tool execution) ──
    // Starts loading relevant memories while the model streams; avoids blocking
    const pendingMemoryPrefetch = deps.createMemoryPrefetch
      ? deps.createMemoryPrefetch(task.sessionId, task.projectId, task.goal)
      : null

    // ── Token budget check ──
    const budgetSignal = budget.evaluate(budget.totalTokens)
    if (budgetSignal === 'exhausted') {
      telemetry.emit('agent_token_budget_completed', {
        totalBudget: budget.config.total,
        consumedTokens: budget.totalTokens,
        consumedRatio: budget.consumedRatio,
      })
      await flushEvents()
      return { reason: 'token_budget_exhausted', finalState: state }
    }

    // ── USD cost budget check ──
    if (params.maxBudgetUsd !== undefined && costTracker.totalCost >= params.maxBudgetUsd) {
      telemetry.emit('agent_token_budget_completed', {
        totalBudget: params.maxBudgetUsd,
        consumedTokens: budget.totalTokens,
        consumedRatio: costTracker.totalCost / params.maxBudgetUsd,
      })
      await flushEvents()
      return { reason: 'budget_exhausted', finalState: state }
    }

    // ── Drain pending task notifications (background workers) ──
    // Consume completed worker results and inject as user-role messages
    // before the LLM call. Mirrors Claude Code's <task-notification> pattern.
    if (state.turnCount > 0) {
      try {
        const { taskNotificationQueue } = await import('../TaskNotificationQueue')
        const notifications = taskNotificationQueue.drainPending(task.sessionId)
        for (const notifMsg of notifications) {
          state.messages.push(notifMsg)
        }
        if (notifications.length > 0) {
          telemetry.emit('agent_task_notification_consumed' as TelemetryEventType, {
            count: notifications.length,
          })
        }
      } catch { /* notification drain is best-effort */ }
    }

    // Inject meta continue message if approaching budget
    const continueMsg = budget.buildContinueMessage()
    if (continueMsg && state.turnCount > 0) {
      state.messages.push({ role: 'user', content: continueMsg })
    }

    // ── Tool result budget enforcement (before microcompact — same content the model sees) ──
    if (state.turnCount > 0) {
      const budgetResult = applyToolResultBudget(state.messages)
      if (budgetResult.replacedCount > 0) {
        state.messages = budgetResult.messages
      }
    }

    // ── Compaction warning check (before pipeline) ──
    if (state.turnCount > 0 && profile.context.autoCompact) {
      const currentTokens = estimateTokens(state.messages)
      const totalBudget = profile.context.budgets?.messages ?? 60000

      // Check warning suppression — periodically auto-clear
      state.compactWarningState = {
        ...state.compactWarningState,
        ...(
          state.compactWarningState.suppressed &&
          Date.now() - state.compactWarningState.lastWarningAt > 60_000
            ? { suppressed: false }
            : {}
        ),
      }

      if (shouldWarnCompact(currentTokens, totalBudget, state.compactWarningState)) {
        state.compactWarningState = suppressWarn(state.compactWarningState, currentTokens)
        state = withTransition(state, 'compact_warning_emitted')
        yield createSessionEvent(task, 'AgentMessage', {
          content: `[Context is at ${Math.round(currentTokens / totalBudget * 100)}% of budget. Compaction may occur soon.]`,
        })
        // Store the warning in the compact warning state for persistence
        // (pipelineTracking is now on state, no separate shadow variable)
      }
    }

    // ── Compaction pipeline (5-stage: Snip → Microcompact → Collapse → Auto-compact) ──
    if (state.turnCount > 0 && profile.context.autoCompact) {
      queryCheckpoint('compaction_start')
      const budgetBefore = budget.totalTokens
      const pipelineResult = await runCompaction(
        state.messages, profile,
        {
          collapseManager: state.collapseManager,
          existingSummary: state.pipelineTracking.summary,
        },
        state.pipelineTracking,
      )

      if (pipelineResult.stagesApplied.length > 0) {
        state.messages = pipelineResult.messages
        state.compactSummary = pipelineResult.summary
        state.lastCompact = {
          summary: pipelineResult.summary,
          tokensFreed: pipelineResult.totalTokensFreed,
          removedMessageCount: pipelineResult.totalCompressedCount,
          at: Date.now(),
        }
        state.pipelineTracking = pipelineResult.tracking

        // Emit events for each stage that fired
        for (const stage of pipelineResult.stagesApplied) {
          switch (stage) {
            case 'snip':
              state.snipTracking.snipCount++
              state.snipTracking.lastSnipAt = Date.now()
              state.snipTracking.totalRemovedBySnip += pipelineResult.totalCompressedCount
              state = withTransition(state, 'snip_applied')
              telemetry.emit('agent_snip_compact_applied', {
                tokensFreed: pipelineResult.totalTokensFreed,
                compressedMessageCount: pipelineResult.totalCompressedCount,
              })
              break
            case 'time-microcompact':
              state.timeMicrocompactState.lastTimeMicrocompactAt = Date.now()
              state = withTransition(state, 'time_microcompact_applied')
              telemetry.emit('agent_microcompact_applied', {
                tokensFreed: pipelineResult.totalTokensFreed,
                compressedMessageCount: pipelineResult.totalCompressedCount,
              })
              break
            case 'collapse':
              state = withTransition(state, 'collapse_applied')
              telemetry.emit('agent_context_collapse_applied', {
                tokensFreed: pipelineResult.totalTokensFreed,
                compressedMessageCount: pipelineResult.totalCompressedCount,
              })
              break
            case 'auto-compact':
              state = withTransition(state, 'auto_compact_applied')
              telemetry.emit('agent_auto_compact_succeeded', {
                tokensFreed: pipelineResult.totalTokensFreed,
                compressedMessageCount: pipelineResult.totalCompressedCount,
                preCompactTokens: estimateTokens(state.messages),
                postCompactTokens: estimateTokens(pipelineResult.messages),
              })
              break
          }
        }

        // Emit a single CompactBoundary event summarizing all stages
        emitEvent(createSessionEvent(task, 'CompactBoundary', {
          summary: pipelineResult.summary,
          tokenSaved: pipelineResult.totalTokensFreed,
          compactedMessageCount: pipelineResult.totalCompressedCount,
          stages: pipelineResult.stagesApplied,
        } as any))

        // Clear warning suppression after compaction
        state.compactWarningState = clearWarnSuppression(state.compactWarningState)
        budget.recordCompactBoundary(budgetBefore, budget.totalTokens)
      }
      queryCheckpoint('compaction_end')
    }

    // ── Tool pairing validation (pre-flight) ──
    // Prevent Anthropic API 400 errors from orphaned tool_use blocks
    const repairedCount = validateAndRepairToolPairing(state.messages)
    if (repairedCount > 0) {
      console.warn(`[query-loop] repaired ${repairedCount} orphaned tool_use(s) before LLM call (turn ${state.turnCount})`)
    }

    // ── LLM Call with fallback inner loop ──
    const messageId = `msg_${deps.uuid().slice(0, ID_PREFIX_LENGTH)}`
    yield createSessionEvent(task, 'AgentMessage', { content: '' })

    // Streaming tool executor
    queryCheckpoint('api_streaming_start')
    const streamExec = createStreamExec(task.id, task.sessionId, task.projectId)
    let nextStreamIndex = 0
    const streamToolIdByIndex = new Map<number, string>()

    // Resolve model for this call
    const resolveModel = (): string | undefined => {
      if (state.maxOutputTokensOverride) return undefined // keep same model, just change max_tokens
      return task.modelName || (params.modelSlot === 'subagent' ? slotResolver?.subagent() : slotResolver?.main())
    }

    let fallbackAttempted = false
    let maxOutputRecoveryCount = 0
    let result: LLMChatResult
    let modelName: string | undefined = resolveModel()

    // Inner fallback loop — retries with model fallback + max_output escalation
    while (true) {
      try {
        result = await deps.callModel(
          {
            systemPrompt: state.systemPrompt,
            messages: state.messages,
            tools: toolsForLoop.map(t => ({
              name: t.name,
              description: t.description,
              input_schema: t.input_schema as Record<string, unknown>,
            })),
            signal,
            model: modelName,
            maxOutputTokens: state.maxOutputTokensOverride,
            taskBudget: { total: budget.remaining },
          },
          (chunk) => {
            switch (chunk.type) {
              case 'text_delta':
                // Fire-and-forget: streaming chunks are high-frequency,
                // persistence is deferred via emitAsync to avoid blocking
                // the streaming loop. Mirrors Claude Code's void recordTranscript.
                queryCheckpoint('first_chunk_received')
                agentEventBus.emitAsync(createSessionEvent(task, 'AgentMessageChunk', {
                  content: chunk.text || '',
                  isFinal: false,
                  messageId,
                }))
                break
              case 'tool_use_start': {
                const idx = nextStreamIndex++
                streamToolIdByIndex.set(idx, chunk.id!)
                streamExec.addTool(idx, chunk.id!, chunk.name!)
                break
              }
              case 'tool_use_delta':
                streamExec.accumulateInput(chunk.id!, chunk.input_json!)
                break
              case 'content_block_stop':
                for (const [idx, id] of streamToolIdByIndex) {
                  if (streamExec.tryCompleteTool(idx, id)) break
                }
                break
              case 'message_stop':
                break
            }
          },
        )
        queryCheckpoint('api_streaming_end')
        break // success — exit inner fallback loop
      } catch (err) {
        queryCheckpoint('api_streaming_end')
        // Discard in-flight streaming tools (model switch mid-stream).
        // discard() marks queued/in-progress tools with synthetic errors
        // so they don't leak stale tool_use_ids into the retry.
        streamExec.discard()

        // Check if this is a fallback-triggered error (model should switch)
        const errAny = err as any
        const isFallbackTriggered = errAny?.name === 'FallbackTriggeredError' || errAny?.fallbackTriggered

        if (isFallbackTriggered && !fallbackAttempted && slotResolver) {
          // Attempt model fallback — switch to fallback model
          fallbackAttempted = true
          modelName = slotResolver.fallback()
          state = withTransition(state, 'fallback_model_recovery')
          telemetry.emit('agent_fallback_model_triggered', {
            originalModel: task.modelName || 'default',
            fallbackModel: modelName,
          })
          // Clean up orphaned streaming tool state
          streamToolIdByIndex.clear()
          nextStreamIndex = 0
          // Create fresh executor for the retry — prevents stale tool state
          streamExec = deps.createStreamingExecutor!(task.id, task.sessionId, task.projectId)
          continue
        }

        // Check if this is a max_output_tokens error (hit output limit)
        const isMaxTokens = (errAny?.code === 'max_tokens' || errAny?.stop_reason === 'max_tokens') ||
          (errAny?.message && /maximum (output|token)/i.test(errAny.message))

        if (isMaxTokens && maxOutputRecoveryCount < MAX_OUTPUT_RECOVERY_ATTEMPTS) {
          const escalated = escalateMaxOutputTokens(state.maxOutputTokensOverride)
          if (escalated !== undefined) {
            maxOutputRecoveryCount++
            state.maxOutputTokensOverride = escalated
            state.maxOutputTokensRecoveryCount = maxOutputRecoveryCount
            state = withTransition(state, 'max_output_tokens_recovery')
            telemetry.emit('agent_max_output_recovery', {
              attempt: maxOutputRecoveryCount,
              maxAttempts: MAX_OUTPUT_RECOVERY_ATTEMPTS,
              escalatedTo: escalated,
            })
            continue
          }
        }

        // ── Context-length / media-size layered recovery ──
        //
        // Recovery path order (mirrors Claude Code's query.ts layered pattern):
        //
        //   [BEFORE this block]  Fallback model recovery — switch model, same params
        //   [BEFORE this block]  Max-output-token recovery — escalate max_tokens, same params
        //
        //   LAYER 1: Collapse drain — flush all staged non-destructive collapses.
        //            Fast + cheap (no LLM call). Keeps granular context.
        //            If successful → retry LLM call.
        //
        //   LAYER 2: Reactive compact — LLM summarization of early turns.
        //            Slow + expensive (extra LLM call). Full context summary.
        //            Guarded by hasAttemptedReactiveCompact to prevent infinite loops.
        //            If successful → retry LLM call.
        //
        //   [AFTER this block]  routeError — generic recovery (rate-limit wait,
        //                       transparent retry, circuit-breaker termination).
        //
        // Only for context-length (413 / prompt_too_long) or media-size errors.
        // Auth errors, rate limits, and transient server errors fall through to routeError.
        const isContextError = isContextLengthError(err)
        const isMediaError = isFeatureOn('MEDIA_ERROR_RECOVERY') && isMediaSizeError(err)

        if (isContextError || isMediaError) {
          // Layer 1: Collapse drain — flush all staged collapses (fast, no LLM cost)
          if (isFeatureOn('CONTEXT_COLLAPSE') && isContextError) {
            const collapseMgr = state.collapseManager
            if (collapseMgr?.isEnabled()) {
              const drained = collapseMgr.recoverFromOverflow(state.messages)
              if (drained.committed > 0) {
                state.messages = drained.messages
                state = withTransition(state, 'context_collapse_recovery')
                telemetry.emit('agent_context_collapse_applied', {
                  tokensFreed: 0,
                  compressedMessageCount: drained.committed,
                  trigger: 'prompt_too_long',
                })
                // Clean up and retry with drained messages
                streamToolIdByIndex.clear()
                nextStreamIndex = 0
                continue
              }
            }
          }

          // Layer 2: Reactive compact — LLM summarization of early turns (expensive)
          if (isFeatureOn('REACTIVE_COMPACT')) {
            if (!state.hasAttemptedReactiveCompact) {
              const compacted = await tryReactiveCompact({
                hasAttempted: state.hasAttemptedReactiveCompact,
                messages: state.messages,
                profile,
                existingSummary: state.compactSummary,
                error: err,
              })
              if (compacted) {
                state.messages = compacted.messages
                state.compactSummary = compacted.summary
                state.hasAttemptedReactiveCompact = true
                state = withTransition(state, 'reactive_compact_recovery')
                telemetry.emit('agent_reactive_compact_succeeded', {
                  stage: compacted.compressedCount > 0 ? 'compact_turns' : 'truncate_results',
                  tokensFreed: compacted.tokensFreed,
                  compressedMessageCount: compacted.compressedCount,
                })
                // Clean up and retry with compacted messages
                streamToolIdByIndex.clear()
                nextStreamIndex = 0
                continue
              }
            }
            state.hasAttemptedReactiveCompact = true
          }

          // Layered recovery exhausted — surface the error
          telemetry.emit('agent_query_error', {
            errorType: isMediaError ? 'media_size' : 'context_length',
            errorMessage: (err as any)?.message?.slice(0, 200) || 'Context error',
            recoveryLevel: 'fail',
            turnCount: state.turnCount,
          })
          yield createSessionEvent(task, 'TaskFailed', {
            error: (err as any)?.message || 'Context too large — compaction failed to recover',
            recoverable: false,
          })
          await flushEvents()
          return { reason: 'blocking_limit', finalState: state }
        }

        // Route through unified recovery system (with attempt limits + circuit breaker)
        const routeResult = await routeError(
          err, recovery, signal,
          state.messages, profile, state.compactSummary,
          task.sessionId, task.id,
        )

        if (routeResult.level === 'fail') {
          telemetry.emit('agent_query_error', {
            errorType: (err as any)?.code || 'unknown',
            errorMessage: err instanceof Error ? err.message.slice(0, 200) : 'LLM call failed',
            recoveryLevel: 'fail',
            turnCount: state.turnCount,
          })
          yield createSessionEvent(task, 'TaskFailed', {
            error: err instanceof Error ? err.message : 'LLM call failed after all recovery attempts',
            recoverable: false,
          })
          await flushEvents()
          return { reason: 'model_error', finalState: state }
        }

        if (routeResult.level === 'retry' || routeResult.level === 'wait_retry') {
          state = withTransition(state, routeResult.level === 'retry' ? 'retry_recovery' : 'wait_retry_recovery')
          continue
        }

        if (routeResult.level === 'compact') {
          state = withTransition(state, 'reactive_compact_recovery')
          state.hasAttemptedReactiveCompact = true
          // Compacted messages were mutated in-place by routeError
          continue
        }

        if (routeResult.level === 'collapse') {
          state = withTransition(state, 'context_collapse_recovery')
          continue
        }

        // Should not reach here — routeError only returns valid levels
        await flushEvents()
        return { reason: 'model_error', finalState: state }
      }
    }

    // Reset recovery on success (but keep circuit breaker state for tracking)
    recovery.globalAttempts = 0

    // Final chunk
    emitEvent(createSessionEvent(task, 'AgentMessageChunk', {
      content: '',
      isFinal: true,
      messageId,
    }))

    // Record token usage
    state.totalInputTokens += result.usage.inputTokens
    state.totalOutputTokens += result.usage.outputTokens
    budget.recordUsage(result.usage.inputTokens, result.usage.outputTokens)

    // ── Post-sampling hooks ──
    const lastText = result.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join(' ')
    const hookResult = await executeHooks({
      task, turnCount: state.turnCount + 1,
      messages: state.messages,
      lastAssistantContent: lastText,
      profileId: profile.id,
    })
    if (hookResult.preventContinuation) {
      yield createSessionEvent(task, 'TaskFailed', {
        error: hookResult.blocking || 'Hook prevented continuation',
        recoverable: false,
      })
      return { reason: 'aborted', finalState: state }
    }
    if (hookResult.messages && hookResult.messages.length > 0) {
      state.systemPrompt = `${state.systemPrompt}\n\n[Hook feedback]\n${hookResult.messages.join('\n')}`
    }

    // ── Stop hooks ──
    const stopHookResult = await executeStopHooks('Stop', {
      task, turnCount: state.turnCount + 1,
      messages: state.messages,
      lastAssistantContent: lastText,
      profileId: profile.id,
    })
    if (stopHookResult.preventContinuation) {
      yield createSessionEvent(task, 'TaskFailed', {
        error: stopHookResult.blocking || 'Stop hook prevented continuation',
        recoverable: false,
      })
      return { reason: 'aborted', finalState: state }
    }
    if (stopHookResult.messages && stopHookResult.messages.length > 0) {
      state.systemPrompt = `${state.systemPrompt}\n\n[Stop hooks]\n${stopHookResult.messages.join('\n')}`
    }

    // ── Tool Execution ──
    queryCheckpoint('tool_execution_start')
    const toolUses = result.content.filter(
      (b): b is LLMToolUseBlock => b.type === 'tool_use',
    )
    const streamedResults = streamExec.allResults

    if (toolUses.length === 0 && streamedResults.length === 0) {
      state.transition = undefined
      telemetry.emit('agent_query_completed', {
        reason: 'completed',
        turnCount: state.turnCount,
        totalInputTokens: state.totalInputTokens,
        totalOutputTokens: state.totalOutputTokens,
        totalTokens: state.totalInputTokens + state.totalOutputTokens,
        durationMs: Date.now() - queryStartTime,
        toolUseCount: state.toolUseCount,
      })
      await flushEvents()
      return { reason: 'completed', finalState: state, structuredOutput: extractedStructuredOutput }
    }

    // Collect streaming results
    const remainingStreamResults = await streamExec.getRemainingResults()
    const allStreamResults = [...streamedResults, ...remainingStreamResults]

    // Telemetry: streaming tool execution characteristics
    if (toolUses.length > 0) {
      const streamedCount = allStreamResults.length
      const batchCount = toolUses.length - streamedCount
      if (streamedCount > 0) {
        telemetry.emit('agent_streaming_tool_used', {
          toolCount: toolUses.length,
          streamedCount,
          batchCount,
        })
      } else {
        telemetry.emit('agent_streaming_tool_not_used', {
          toolCount: toolUses.length,
        })
      }
    }

    let toolResultBlocks: LLMContentBlock[]
    if (allStreamResults.length > 0) {
      for (const r of allStreamResults) {
        yield createSessionEvent(task, 'ToolCallStarted', {
          toolCallId: r.toolCallId, toolId: r.toolUse.name, toolName: r.toolUse.name,
          input: r.toolUse.input, riskLevel: 'read',
        })
        yield createSessionEvent(task, 'ToolCallFinished', {
          toolCallId: r.toolCallId, toolId: r.toolUse.name, toolName: r.toolUse.name,
          output: r.output, status: r.success ? 'success' : 'error',
          error: r.error?.message, duration: 0,
        })
        state.toolUseCount++
      }

      const streamedToolNames = new Set(allStreamResults.map(r => r.toolUse.name))
      const unstreamedUses = toolUses.filter(tu => !streamedToolNames.has(tu.name))

      if (unstreamedUses.length > 0) {
        const execResult = yield* runToolBatch(
          state, task, profile, unstreamedUses, signal,
        )
        if (typeof execResult === 'string') {
          return { reason: execResult as TerminalReason, finalState: state }
        }
        toolResultBlocks = execResult
      } else {
        toolResultBlocks = []
      }

      const streamedBlocks: LLMContentBlock[] = allStreamResults.map(r => ({
        type: 'tool_result' as const,
        tool_use_id: r.toolUse.id,
        content: r.success
          ? (typeof r.output === 'string' ? r.output : JSON.stringify(r.output))
          : `Error: ${r.error?.message || 'Unknown error'}`,
      }))
      toolResultBlocks = [...toolResultBlocks, ...streamedBlocks]
    } else {
      const execResult = yield* runToolBatch(
        state, task, profile, toolUses, signal,
      )
      if (typeof execResult === 'string') {
        return { reason: execResult as TerminalReason, finalState: state }
      }
      toolResultBlocks = execResult
    }

    // ── Structured output extraction ──
    if (structuredOutputEnabled) {
      const soToolUse = toolUses.find(tu => tu.name === STRUCTURED_OUTPUT_TOOL_NAME)
      if (soToolUse) {
        structuredOutputCallCount++
        const soResult = toolResultBlocks.find(
          b => b.type === 'tool_result' && b.tool_use_id === soToolUse.id,
        )
        if (soResult?.type === 'tool_result') {
          try {
            const parsed = typeof soResult.content === 'string'
              ? JSON.parse(soResult.content)
              : soResult.content
            const validation = executeStructuredOutput(
              (parsed as Record<string, unknown>) || {},
              jsonSchema!,
            )
            if (validation.valid) {
              extractedStructuredOutput = validation.data
              // Success — the model produced valid structured output.
              // We still continue to emit the tool events; the result carries the output.
            }
          } catch {
            // Content wasn't valid JSON — that's fine, the executeStructuredOutput
            // will handle it in the next iteration if the model retries.
          }
        }
      }

      // Check if we've exceeded structured output retries
      if (structuredOutputCallCount >= MAX_STRUCTURED_OUTPUT_RETRIES && extractedStructuredOutput === undefined) {
        telemetry.emit('agent_query_error', {
          errorType: 'max_structured_output_retries',
          errorMessage: `Failed to provide valid structured output after ${MAX_STRUCTURED_OUTPUT_RETRIES} attempts`,
          recoveryLevel: 'fail',
          turnCount: state.turnCount,
        })
        yield createSessionEvent(task, 'TaskFailed', {
          error: `Failed to provide valid structured output after ${MAX_STRUCTURED_OUTPUT_RETRIES} attempts`,
          recoverable: false,
        })
        await flushEvents()
        return { reason: 'model_error', finalState: state }
      }
    }

    // ── Tool use summary (hybrid: heuristic for ≤2 tools, LLM for >2) ──
    queryCheckpoint('tool_execution_end')

    // Consume async memory prefetch (if it resolved during model streaming / tool execution)
    if (pendingMemoryPrefetch) {
      try {
        const memoryMsgs = await pendingMemoryPrefetch
        if (memoryMsgs.length > 0) {
          // Prepend memory messages before tool results so the next LLM call sees them
          toolResultBlocks = [...memoryMsgs, ...toolResultBlocks]
        }
      } catch { /* memory prefetch is best-effort; failures are silently ignored */ }
    }

    if (toolResultBlocks.length > 0) {
      // Start summary generation (async — we want to overlap with event flushing)
      const summaryPromise = toolUses.length > 2
        ? generateLLMToolUseSummary(toolUses, toolResultBlocks, state.turnCount, deps.compactModel ?? '')
        : Promise.resolve(generateToolUseSummary(toolUses, toolResultBlocks, state.turnCount))

      const summary = await summaryPromise
      if (summary.charsSaved > 0) {
        const summaryMessage = buildToolUseSummaryMessage(summary, messageId)
        if (summaryMessage) {
          // Append summary before the tool result blocks
          // The summary will be consumed by the next LLM call as context
          appendTurnToHistory(state, result.content, toolResultBlocks, summaryMessage)
          state = withTransition(state, 'tool_use_found')
          state.turnCount++
          // Record continue for token budget tracking
          budget.recordContinue(budget.totalTokens)
          telemetry.emit('agent_token_budget_continuation', {
            totalBudget: budget.config.total,
            consumedTokens: budget.totalTokens,
            consumedRatio: budget.consumedRatio,
            continuationCount: budget.config.diminishingReturnsStreak,
            turnTokens: budget.totalTokens,
          })
          continue
        }
      }
    }

    // Append assistant + tool results to history
    appendTurnToHistory(state, result.content, toolResultBlocks)
    state = withTransition(state, 'tool_use_found')
    state.turnCount++

    // Record continue for token budget tracking
    budget.recordContinue(budget.totalTokens)
  }

  telemetry.emit('agent_query_completed', {
    reason: 'max_turns',
    turnCount: state.turnCount,
    totalInputTokens: state.totalInputTokens,
    totalOutputTokens: state.totalOutputTokens,
    totalTokens: state.totalInputTokens + state.totalOutputTokens,
    durationMs: Date.now() - queryStartTime,
    toolUseCount: state.toolUseCount,
  })
  queryCheckpoint('query_loop_exit')
  logQueryProfileReport()
  await flushEvents()
  return { reason: 'max_turns', finalState: state, structuredOutput: extractedStructuredOutput }
}

// ── Tool batch execution (extracted from inner loop) ──

/**
 * Execute all tool_use blocks from the LLM response.
 *
 * ALL tools go through ToolOrchestrator which handles concurrency safety,
 * permission checks, and context modifier chains. Agent spawning tools
 * (spawn_agent, send_message) are treated the same as any other tool —
 * their implementations handle sync vs async (run_in_background) internally.
 *
 * This unified path replaces the previous agentCalls/regularCalls split
 * where agent calls were routed through CoordinatorMode directly.
 */
async function* runToolBatch(
  state: AgentState,
  task: AgentTask,
  profile: AgentProfile,
  toolUses: LLMToolUseBlock[],
  signal: AbortSignal,
): AsyncGenerator<SessionEvent, 'aborted' | 'denied' | LLMContentBlock[], void> {
  if (toolUses.length === 0) return []

  const toolResults: LLMContentBlock[] = []

  // Pass parent messages for coordinator context inheritance
  const parentMessages = profile.id === 'coordinator' ? state.messages : undefined
  const orchestrated = await orchestrateTools(
    toolUses, task.id, task.sessionId, task.projectId,
    profile.execution.maxParallelTools,
    undefined, // toolUseContext
    undefined, // deps
    parentMessages,
  )

  for (const tr of orchestrated.results) {
    if (signal.aborted) {
      yield createSessionEvent(task, 'TaskFailed', { error: 'Task cancelled by user', recoverable: false })
      return 'aborted'
    }

    yield createSessionEvent(task, 'ToolCallStarted', {
      toolCallId: tr.toolCallId, toolId: tr.toolUse.name, toolName: tr.toolUse.name,
      input: tr.toolUse.input, riskLevel: 'read',
    })
    yield createSessionEvent(task, 'ToolCallFinished', {
      toolCallId: tr.toolCallId, toolId: tr.toolUse.name, toolName: tr.toolUse.name,
      output: tr.output, status: tr.success ? 'success' : 'error',
      error: tr.error?.message, duration: 0,
    })

    toolResults.push(buildToolResultBlock(tr.toolUse, tr.output))
    state.toolUseCount++
  }

  if (orchestrated.denied) return 'denied'

  // Context modifiers are handled internally by ToolOrchestrator
  // (applied to ToolUseContext before each subsequent tool execution).

  return toolResults
}

// ── Append turn to history ──

function appendTurnToHistory(
  state: AgentState,
  contentBlocks: LLMContentBlock[],
  toolResults: LLMContentBlock[],
  toolSummaryMessage?: LLMMessage | null,
): void {
  const assistantBlocks = contentBlocks.filter(
    (b) => b.type === 'text' || b.type === 'tool_use',
  )
  state.messages.push({ role: 'assistant', content: assistantBlocks as LLMContentBlock[], timestamp: Date.now() })
  // Track last assistant timestamp for time-based microcompact gap detection
  state.timeMicrocompactState.lastAssistantTimestamp = Date.now()
  if (toolResults.length > 0) {
    const compacted = microcompact(toolResults as { content: string }[])
    state.messages.push({ role: 'user', content: compacted as LLMContentBlock[] })
  }
  // Inject tool summary if available (buildToolUseSummaryMessage returns LLMMessage)
  if (toolSummaryMessage) {
    state.messages.push(toolSummaryMessage)
  }
}

// ── Public type aliases (preferred names for Agent consumers) ──

/** @alias QueryLoopParams */
export type AgentExecutionParams = QueryLoopParams
/** @alias QueryLoopDeps */
export type AgentExecutionDeps = QueryLoopDeps
/** @alias QueryLoopResult */
export type AgentExecutionResult = QueryLoopResult
/** @alias queryLoop */
export { queryLoop as executeLoop }

