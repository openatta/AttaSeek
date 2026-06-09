/**
 * QueryEngine — session-level conversation manager.
 *
 * One QueryEngine per session. Manages mutable conversation state
 * (messages, usage, file cache, permissions) across turns. Each
 * submitMessage() call starts a new query-loop turn within the
 * same conversation.
 *
 * Mirrors Claude Code's QueryEngine (src/QueryEngine.ts).
 *
 * Phase B: session management + query-loop delegation.
 * Phase D: tool permission context, content replacement.
 */

import { agentEventBus } from '../AgentEventBus'
import { createSessionEvent, emitNonFatal } from '../events'
import { queryLoop, productionLoopDeps } from './query-loop'
import type { QueryLoopResult, QueryLoopDeps } from './query-loop'
import { ContextAssembler, contextAssembler } from '../context/ContextAssembler'

import { artifactService } from '../../artifacts/ArtifactService'
import { memoryService } from '../../memory/MemoryService'
import { auditService } from '../../audit/AuditService'
import { extractMemories } from '../memory/MemoryExtractor'
import { validateProfile } from '../profile/AgentProfile'
import { modelProviderRegistry } from '../llm/ModelProviderRegistry'
import { loadLLMConfig } from '../llm/AttaSettingsLoader'
import { ModelResolver } from '../llm/ModelResolver'
import { buildQueryConfig } from './QueryConfig'
import { commandRegistry } from '../commands/CommandRegistry'
import { registerBuiltinCommands } from '../commands/builtin-commands'
import { TelemetryService } from '../telemetry/TelemetryService'
import { feature } from '../features/FeatureFlags'
import type { AgentTask } from '../../../shared/types/AgentTask'
import type { AgentProfile } from '../profile/AgentProfile'
import type { SessionEvent, SessionEventPayloadMap } from '../../../shared/types/SessionEvent'
import type { TerminalReason } from './transitions'
import type { LLMMessage, LLMToolDef } from '../llm/ModelProvider'
import { TRUNCATE_SHORT } from '../../../shared/constants'

// ── Knowledge cutoff lookup (model ID pattern → cutoff date) ──

interface ModelInfo {
  modelId?: string
  modelProvider?: string
  knowledgeCutoff?: string
  modelFamilyIds?: string
}

function resolveModelInfo(modelOverride?: string): ModelInfo {
  try {
    const config = loadLLMConfig()
    if (!config.provider) return {}

    const resolver = new ModelResolver(config.provider)
    const modelId = modelOverride ?? resolver.main()
    const providerName = config.provider.def.name

    // Model family IDs + knowledge cutoff only for Claude-family providers
    const isClaudeProvider = providerName.toLowerCase().includes('claude') ||
      providerName.toLowerCase().includes('anthropic')
    const knowledgeCutoff = isClaudeProvider ? getKnowledgeCutoff(modelId) : undefined

    let modelFamilyIds: string | undefined
    if (isClaudeProvider) {
      const slotModels: string[] = []
      if (config.provider.opus) slotModels.push(`Opus: '${config.provider.opus}'`)
      if (config.provider.sonnet) slotModels.push(`Sonnet: '${config.provider.sonnet}'`)
      if (config.provider.haiku) slotModels.push(`Haiku: '${config.provider.haiku}'`)
      modelFamilyIds = slotModels.length > 0
        ? `The most recent Claude model family is Claude 4.X. Model IDs — ${slotModels.join(', ')}. When building AI applications, default to the latest and most capable Claude models.`
        : undefined
    }

    return {
      modelId,
      modelProvider: providerName !== 'Unknown' ? providerName : undefined,
      knowledgeCutoff,
      modelFamilyIds,
    }
  } catch {
    return {}
  }
}

/** Pattern-based knowledge cutoff — mirrors Claude Code's getKnowledgeCutoff(). */
function getKnowledgeCutoff(modelId: string): string | undefined {
  const m = modelId.toLowerCase()
  if (m.includes('claude-sonnet-4-6')) return 'August 2025'
  if (m.includes('claude-opus-4-6') || m.includes('claude-opus-4-5')) return 'May 2025'
  if (m.includes('claude-haiku-4')) return 'February 2025'
  if (m.includes('claude-opus-4') || m.includes('claude-sonnet-4')) return 'January 2025'
  if (m.includes('claude-3')) return 'August 2024'
  if (m.includes('gpt-4o')) return 'June 2024'
  if (m.includes('gpt-4')) return 'September 2021'
  if (m.includes('gemini-2')) return 'August 2025'
  if (m.includes('gemini-1')) return 'February 2024'
  return undefined
}

// ── Config ──

export interface QueryEngineConfig {
  /** Session identifier */
  sessionId: string
  /** Working directory (for context gathering) */
  cwd?: string
  /** Project root identifier (for CLAUDE.md memory loading) */
  projectId?: string
  /** Custom system prompt append (user settings) */
  appendSystemPrompt?: string
  /** User-specified model override */
  userSpecifiedModel?: string
  /** Fallback model for error recovery */
  fallbackModel?: string
  /** Language preference (en, zh, ja, etc.) */
  language?: string
  /** Maximum turns per submitMessage call */
  maxTurns?: number
  /** Override deps (for testing) */
  testDeps?: Partial<QueryLoopDeps>
  /** Optional JSON schema for structured output enforcement. */
  jsonSchema?: Record<string, unknown>
  /** Model slot for provider resolution. 'main' (default) or 'subagent'. */
  modelSlot?: 'main' | 'subagent'
  /** Execution mode. 'coordinator' activates leader/worker multi-agent orchestration. */
  mode?: 'normal' | 'coordinator'
  /** Max concurrent workers the coordinator can spawn (default 10). */
  maxConcurrentWorkers?: number
  /**
   * Optional service dependencies for finalize() side effects.
   * Defaults to global singletons. Inject for testing or standalone usage.
   */
  services?: {
    createArtifact?: (params: { sessionId: string; taskId: string; type: string; title: string; content: string }) => void
    storeMemory?: (params: { scope: string; scopeId: string; type: string; content: string; source: string; sessionId: string; taskId: string }) => Promise<void>
    logAudit?: (params: { eventType: string; sessionId: string; taskId: string; metadata?: Record<string, unknown> }) => Promise<void>
  }
}

// ── Engine ──

export class QueryEngine {
  private config: QueryEngineConfig
  private mutableMessages: LLMMessage[] = []
  private totalUsage = { inputTokens: 0, outputTokens: 0 }
  private abortController: AbortController | null = null
  private turnCount = 0
  /** Last compaction summary (feeds into next compaction call) */
  private compactSummary?: string

  constructor(config: QueryEngineConfig) {
    this.config = config
  }

  // ── Public API ──

  /**
   * Submit user input and start a new agent turn.
   * Returns an async generator that yields SessionEvents for every
   * observable state change (streaming text, tool calls, compactions, etc.).
   * The generator completes with a TerminalReason.
   */
  async *submitMessage(
    userContent: string,
    task: AgentTask,
    profile?: AgentProfile,
  ) {
    this.abortController = new AbortController()
    const signal = this.abortController.signal

    try {
      // 1. Process slash commands (before context assembly / query loop)
      //    Commands can modify messages, switch models, update tools, or bypass the LLM.
      registerBuiltinCommands() // idempotent — ensures commands are registered
      let shouldQuery = true
      let modelOverride: string | undefined = this.config.userSpecifiedModel
      let customResultText: string | undefined

      const cmdEnabled = feature('SLASH_COMMANDS_IN_LOOP')
      if (cmdEnabled && userContent.trim().startsWith('/')) {
        const cmdCtx = {
          sessionId: this.config.sessionId,
          taskId: task.id,
          messages: this.mutableMessages,
          cwd: this.config.cwd || process.cwd(),
        }
        const cmdResult = await commandRegistry.processUserInput(userContent, cmdCtx)
        if (cmdResult) {
          // Command matched — apply mutations
          shouldQuery = cmdResult.shouldQuery
          if (cmdResult.modelOverride) modelOverride = cmdResult.modelOverride
          if (cmdResult.resultText) customResultText = cmdResult.resultText

          // Inject command-produced messages into the conversation
          if (cmdResult.messages.length > 0) {
            this.mutableMessages.push(...cmdResult.messages)
          }

          // Emit telemetry for command processing
          const telemetry = new TelemetryService(this.config.sessionId, task.id)
          telemetry.emit('agent_command_processed', {
            commandName: userContent.trim().split(/\s+/)[0]?.slice(1) || 'unknown',
            shouldQuery,
            modelOverride: cmdResult.modelOverride,
          })

          // If shouldQuery is false, return directly — no LLM call needed
          if (!shouldQuery) {
            yield createSessionEvent(task, 'AgentMessage', {
              content: customResultText || '',
            })
            yield* this.finalize(task, profile || getDefaultProfile(), 'completed')
            return 'completed'
          }
        }
      }

      // 2. Emit user message + loading placeholder (before slow context assembly)
      yield createSessionEvent(task, 'UserMessage', { content: userContent })
      yield createSessionEvent(task, 'AgentMessage', { content: '' })

      // 3. Context assembly — messages, tools, git/OS/date context via ContextAssembler
      const effectiveProfile = profile || getDefaultProfile()

      // Resolve model info for env-info injection (R1/R2: knowledgeCutoff + modelFamilyIds)
      const modelInfo = resolveModelInfo(modelOverride)

      const ctx = await contextAssembler.assemble({
        goal: userContent,
        sessionId: this.config.sessionId,
        projectId: this.config.projectId,
        profile: effectiveProfile,
        modelId: modelInfo.modelId,
        modelProvider: modelInfo.modelProvider,
        knowledgeCutoff: modelInfo.knowledgeCutoff,
        modelFamilyIds: modelInfo.modelFamilyIds,
        forkSubagentEnabled: false,
        languagePreference: this.config.language,
      })

      // Merge with existing conversation history (from previous turns)
      const messages: LLMMessage[] = [
        ...this.mutableMessages,
        ...ctx.messages,
      ]

      const tools = ctx.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Record<string, unknown>,
      }))

      // System prompt rendered by ContextAssembler (uses real profile)
      let systemPrompt = ctx.systemPrompt

      // Append system context (git, OS, date) from ContextAssembler
      const sysCtx = ctx.systemContext || {}
      if (Object.keys(sysCtx).length > 0) {
        const sysParts: string[] = []
        if (sysCtx.git) sysParts.push(sysCtx.git)
        if (sysCtx.os) sysParts.push(`OS: ${sysCtx.os}`)
        if (sysCtx.date) sysParts.push(`Date: ${sysCtx.date}`)
        if (sysParts.length > 0) {
          systemPrompt = `${systemPrompt}\n\n## System Context\n${sysParts.join('\n')}`
        }
      }

      if (this.config.appendSystemPrompt) {
        systemPrompt = `${systemPrompt}\n\n${this.config.appendSystemPrompt}`
      }

      // 3. Build query config
      const queryConfig = buildQueryConfig({
        sessionId: this.config.sessionId,
        querySource: 'repl_main_thread',
      })

      // 4. Run the query loop
      const deps: QueryLoopDeps = {
        ...productionLoopDeps(),
        ...this.config.testDeps,
      }

      // Update task with model override from command
      if (modelOverride) {
        task.modelName = modelOverride
      }

      // queryLoop returns QueryLoopResult via yield*. submitMessage's declared
      // return type is TerminalReason, so a cast is required to bridge the
      // generator return-type mismatch. The .reason field is extracted below.
      const loopResult = (yield* queryLoop(
        {
          task,
          profile: effectiveProfile,
          messages,
          systemPrompt,
          tools,
          signal,
          modelSlot: this.config.modelSlot || 'main',
          jsonSchema: this.config.jsonSchema,
        },
        deps,
      )) as unknown as QueryLoopResult

      // 5. Persist conversation state from the query loop
      this.mutableMessages = loopResult.finalState.messages
      this.totalUsage = {
        inputTokens: loopResult.finalState.totalInputTokens,
        outputTokens: loopResult.finalState.totalOutputTokens,
      }
      this.turnCount = loopResult.finalState.turnCount
      if (loopResult.finalState.compactSummary) {
        this.compactSummary = loopResult.finalState.compactSummary
      }

      // 6. Finalize
      yield* this.finalize(task, effectiveProfile, loopResult.reason)

    } finally {
      this.abortController = null
    }
  }

  /** Cancel the currently running execution */
  interrupt(): void {
    this.abortController?.abort()
  }

  /** Get accumulated session-level token usage */
  getTotalUsage(): { inputTokens: number; outputTokens: number } {
    return { ...this.totalUsage }
  }

  /** Get the current message history */
  getMessages(): LLMMessage[] {
    return [...this.mutableMessages]
  }

  /** Get the session config */
  getConfig(): QueryEngineConfig {
    return { ...this.config }
  }

  /**
   * Seed the engine with parent conversation messages for context inheritance.
   * Used by forkWithContext() to give sub-agents visibility into the parent's
   * reasoning chain. Messages are prepended — the ContextAssembler's output
   * is appended on top during submitMessage().
   */
  seedMessages(messages: LLMMessage[]): void {
    this.mutableMessages = [...messages]
  }

  /** Get the current system prompt (for context inheritance). */
  getSystemPrompt(): string {
    // System prompt is assembled during submitMessage() — return empty if not yet set.
    // Sub-agents that inherit context should use the parent's rendered prompt.
    return ''
  }

  // ── Private ──

  private async *finalize(
    task: AgentTask,
    profile: AgentProfile,
    _terminalReason: TerminalReason,
  ): AsyncGenerator<SessionEvent, void, void> {
    task.status = 'completed'
    task.updatedAt = Date.now()

    // Emit completion event so UI can unlock input
    yield createSessionEvent(task, 'TaskCompleted', {})

    // Artifact from last agent message
    if (profile.output.generateArtifact) {
      try {
        const lastMsg = agentEventBus.getHistory(task.sessionId)
          .filter(e => e.type === 'AgentMessage').at(-1)
        if (lastMsg?.payload && 'content' in lastMsg.payload) {
          const createArtifact = this.config.services?.createArtifact ??
            ((params) => { artifactService.create(params) })
          createArtifact({
            sessionId: task.sessionId, taskId: task.id, type: 'markdown',
            title: task.goal.slice(0, TRUNCATE_SHORT),
            content: (lastMsg.payload as { content: string }).content,
          })
        }
      } catch (err) {
        emitNonFatal(task, 'QueryEngine artifact creation failed:', err)
      }
    }

    // Task state memory
    try {
      const storeMemory = this.config.services?.storeMemory ??
        ((params) => memoryService.store(params))
      await storeMemory({
        scope: 'project', scopeId: task.projectId || task.sessionId,
        type: 'task_state', content: `Completed: ${task.goal}`,
        source: 'agent',
        sessionId: task.sessionId, taskId: task.id,
      })
    } catch (err) {
      emitNonFatal(task, 'QueryEngine memory store failed:', err)
    }

    // Audit log
    try {
      const logAudit = this.config.services?.logAudit ??
        ((params) => auditService.log(params))
      await logAudit({
        eventType: 'agent_task_completed', sessionId: task.sessionId,
        taskId: task.id,
        metadata: { goal: task.goal, turns: this.turnCount },
      })
    } catch (err) {
      emitNonFatal(task, 'QueryEngine audit log failed:', err)
    }

    // Memory extraction (fire-and-forget)
    if (profile.memory.autoExtract) {
      extractMemories(
        this.mutableMessages, task.goal, task.sessionId, task.projectId,
      ).catch(err => emitNonFatal(task, 'QueryEngine memory extraction failed:', err))
    }

    yield createSessionEvent(task, 'TaskCompleted', { summary: task.goal })
  }

}

// ── Default profile (module-level, allocated once) ──

let _defaultProfile: AgentProfile | null = null

function getDefaultProfile(): AgentProfile {
  if (!_defaultProfile) {
    _defaultProfile = validateProfile({
      id: 'default',
      name: 'AttaSeek Agent',
      description: 'General-purpose AI agent.',
      systemPrompt: {
        id: 'default',
        sections: [{
          name: 'identity', priority: 10,
          content: 'You are an AI agent running in AttaSeek. Use tools when needed. Be concise and helpful.',
        }],
      },
      tools: [], skills: [],
      execution: { maxTurns: 10, maxParallelTools: 1, planning: 'none' as const },
    })
  }
  return _defaultProfile
}

// ── Session-level engine registry ──

/** Map of sessionId → QueryEngine. Created by AgentRuntime, cleaned up on session end. */
const _engines = new Map<string, QueryEngine>()

export function getQueryEngine(sessionId: string, config?: QueryEngineConfig): QueryEngine {
  let engine = _engines.get(sessionId)
  if (!engine) {
    if (!config) throw new Error(`[QueryEngine] no engine for session ${sessionId} and no config provided`)
    engine = new QueryEngine(config)
    _engines.set(sessionId, engine)
  }
  return engine
}

export function removeQueryEngine(sessionId: string): void {
  _engines.delete(sessionId)
}

export function hasQueryEngine(sessionId: string): boolean {
  return _engines.has(sessionId)
}
