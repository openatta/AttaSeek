/**
 * AgentOrchestrator — universal agent execution engine.
 *
 * AsyncGenerator-based pipeline. One engine for all profiles —
 * domain-specific behavior comes from AgentProfile, not from code branches.
 *
 * Pipeline (each turn):
 *   1. ContextAssembly   — build system prompt + message history + tools
 *   2. ContextManagement  — check token budget, compact if needed (Phase 3)
 *   3. LLM Call           — stream LLM response, yield chunks
 *   4. Tool Execution     — execute tool_use blocks (serial for now)
 *   5. Post-Turn          — terminal checks, recovery
 * → Finalize              — artifact, memory, audit, title
 */

import { agentEventBus } from '../AgentEventBus'
import { contextBuilder } from '../ContextBuilder'
import { orchestrateTools } from '../tools/ToolOrchestrator'
import { artifactService } from '../../artifacts/ArtifactService'
import { memoryService } from '../../memory/MemoryService'
import { auditService } from '../../audit/AuditService'
import { llmProviderRegistry } from '../llm/LLMProviderRegistry'
import { newId } from '../../store/id'
import { renderPrompt } from '../prompt/PromptTemplate'
import { shouldCompact, compactConversation } from '../compact/ContextCompactor'
import { extractMemories } from '../memory/MemoryExtractor'
import { createInitialState, type AgentState, type TerminalReason, type RecoveryLevel } from './AgentState'
import type { AgentTask } from '../../../shared/types/AgentTask'
import type { AgentProfile } from '../profile/AgentProfile'
import type { SessionEvent } from '../../../shared/types/SessionEvent'
import type { LLMContentBlock, LLMToolUseBlock, LLMChatResult } from '../llm/LLMProvider'

const CONTENT_TRUNCATE_LIMIT = 4000

export class AgentOrchestrator {
  private abortController: AbortController | null = null

  /** Main entry point — returns an async generator that yields SessionEvents.
   *  @param provider Optional LLMProvider override (for testing). Falls back to registry lookup.
   *  @param assembledContext Optional pre-built context (for testing). Bypasses ContextBuilder. */
  async *submitMessage(
    task: AgentTask,
    profile: AgentProfile,
    providerOverride?: import('../llm/LLMProvider').LLMProvider,
    assembledContext?: { messages: any[]; tools: any[]; systemPrompt?: string },
  ): AsyncGenerator<SessionEvent, TerminalReason, void> {
    this.abortController = new AbortController()
    const state = createInitialState(task, profile)
    const signal = this.abortController.signal

    try {
      // Check provider — use override if provided (for testing), else registry
      const provider = providerOverride
        || (task.modelConfigId ? llmProviderRegistry.getById(task.modelConfigId) : null)
        || llmProviderRegistry.getDefault()

      if (!provider) {
        yield this.failEvent(task, 'No LLM provider configured. Please set an API key in Settings.')
        return 'no_provider'
      }

      // ── 1. Context Assembly ──
      let tools: any[]
      if (assembledContext) {
        // Testing path: use pre-built context, skip DB-dependent ContextBuilder
        state.systemPrompt = assembledContext.systemPrompt || renderPrompt(profile.systemPrompt, {
          profile, skills: [], tools: [], memories: [],
          sessionId: task.sessionId, projectId: task.projectId,
          date: new Date().toISOString().slice(0, 10), goal: task.goal,
        })
        state.messages = assembledContext.messages
        tools = assembledContext.tools || []
      } else {
        const promptCtx = {
          profile: state.profile, skills: [], tools: [], memories: [],
          sessionId: task.sessionId, projectId: task.projectId,
          date: new Date().toISOString().slice(0, 10), goal: task.goal,
        }
        state.systemPrompt = renderPrompt(profile.systemPrompt, promptCtx)
        const ctx = await contextBuilder.build({
          goal: task.goal, sessionId: task.sessionId, projectId: task.projectId,
        })
        state.messages = ctx.messages
        tools = ctx.tools || []
      }

      // ── Main loop ──
      while (state.turnCount < profile.execution.maxTurns) {
        if (signal.aborted) {
          return 'aborted'
        }

        // ── 2. Context Management (compaction) ──
        if (state.turnCount > 0 && profile.context.autoCompact && shouldCompact(state.messages, profile)) {
          const compacted = await compactConversation(state.messages, profile, state.compactSummary)
          state.messages = compacted.compactedMessages
          state.compactSummary = compacted.summary
          agentEventBus.emit(this.makeEvent(task, 'CompactBoundary', {
            summary: compacted.summary,
            tokenSaved: compacted.tokenSaved,
            compactedMessageCount: compacted.compactedCount,
          }))
        }

        // ── 3. LLM Call ──
        const messageId = `msg_${newId().slice(0, 8)}`

        yield this.makeEvent(task, 'AgentMessage', { content: '' })

        let result: LLMChatResult
        try {
          result = await provider.chatStream(
            {
              systemPrompt: state.systemPrompt,
              messages: state.messages,
              tools: tools.map(t => ({
                name: t.name,
                description: t.description,
                input_schema: t.input_schema as Record<string, unknown>,
              })),
              signal,
            },
            (chunk) => {
              if (chunk.type === 'text_delta') {
                agentEventBus.emit(this.makeEvent(task, 'AgentMessageChunk', {
                  content: chunk.text,
                  isFinal: false,
                  messageId,
                }))
              }
            },
          )
        } catch (err) {
          const recovery = await this.recoverFromError(state, err)
          if (recovery === 'fail') {
            yield this.failEvent(task, err instanceof Error ? err.message : 'LLM call failed')
            return 'model_error'
          }
          continue
        }

        // Flush final chunk
        agentEventBus.emit(this.makeEvent(task, 'AgentMessageChunk', {
          content: '',
          isFinal: true,
          messageId,
        }))

        state.totalInputTokens += result.usage.inputTokens
        state.totalOutputTokens += result.usage.outputTokens

        // ── 4. Tool Execution ──
        const toolUses = result.content.filter(
          (b): b is LLMToolUseBlock => b.type === 'tool_use',
        )

        if (toolUses.length === 0) {
          // end_turn → complete
          yield* this.finalizeGenerator(state)
          return 'completed'
        }

        const toolResults: LLMContentBlock[] = []
        const orchestrated = await orchestrateTools(
          toolUses, task.id, task.sessionId, task.projectId,
          profile.execution.maxParallelTools,
        )

        for (const tr of orchestrated.results) {
          if (signal.aborted) {
            yield this.failEvent(task, 'Task cancelled by user')
            return 'aborted'
          }

          yield this.makeEvent(task, 'ToolCallStarted', {
            toolCallId: tr.toolCallId, toolId: tr.toolUse.name, toolName: tr.toolUse.name,
            input: tr.toolUse.input, riskLevel: 'read',
          })

          yield this.makeEvent(task, 'ToolCallFinished', {
            toolCallId: tr.toolCallId, toolId: tr.toolUse.name, toolName: tr.toolUse.name,
            output: tr.output, status: tr.success ? 'success' : 'error',
            error: tr.error?.message, duration: 0,
          })

          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: tr.toolUse.id,
            content: typeof tr.output === 'string'
              ? tr.output
              : JSON.stringify(tr.output).slice(0, CONTENT_TRUNCATE_LIMIT),
          })
          state.toolUseCount++
        }

        if (orchestrated.denied) {
          return 'denied'
        }

        // Append assistant + tool results to message history
        const assistantBlocks = result.content.filter(
          (b) => b.type === 'text' || b.type === 'tool_use',
        )
        state.messages.push({ role: 'assistant', content: assistantBlocks as LLMContentBlock[] })
        if (toolResults.length > 0) {
          state.messages.push({ role: 'user', content: toolResults })
        }

        state.turnCount++
      }

      yield* this.finalizeGenerator(state)
      return 'max_turns'

    } finally {
      this.abortController = null
    }
  }

  /** Cancel a running execution */
  interrupt(): void {
    this.abortController?.abort()
  }

  // ── Private: finalize as generator ──

  private async *finalizeGenerator(state: AgentState): AsyncGenerator<SessionEvent, void, void> {
    const task = state.task
    task.status = 'completed'
    task.updatedAt = Date.now()

    // Generate artifact from last agent message
    if (state.profile.output.generateArtifact) {
      try {
        const lastMsg = agentEventBus.getHistory(task.sessionId)
          .filter(e => e.type === 'AgentMessage').at(-1)
        if (lastMsg?.payload?.content) {
          artifactService.create({
            sessionId: task.sessionId, taskId: task.id, type: 'markdown',
            title: task.goal.slice(0, 50), content: lastMsg.payload.content as string,
          })
        }
      } catch (err) { console.warn('[AgentOrchestrator] artifact creation failed:', err) }
    }

    // Write task_state memory
    try {
      memoryService.store({
        scope: 'project', scopeId: task.projectId || task.sessionId,
        type: 'task_state', content: `Completed: ${task.goal}`,
        source: 'agent', layer: 'L2',
        sessionId: task.sessionId, taskId: task.id,
      })
    } catch (err) { console.warn('[AgentOrchestrator] memory store failed:', err) }

    // Audit log
    try {
      auditService.log({
        eventType: 'agent_task_completed', sessionId: task.sessionId,
        taskId: task.id, userId: 'local',
        metadata: { goal: task.goal, turns: state.turnCount, toolsUsed: state.toolUseCount },
      })
    } catch (err) { console.warn('[AgentOrchestrator] audit log failed:', err) }

    // Fire-and-forget memory extraction
    if (state.profile.memory.autoExtract) {
      extractMemories(state.messages, task.goal, task.sessionId, task.projectId).catch(
        (err) => console.warn('[AgentOrchestrator] memory extraction failed:', err),
      )
    }

    yield this.makeEvent(task, 'TaskCompleted', { summary: task.goal })
  }

  // ── Error recovery ──

  private async recoverFromError(_state: AgentState, _err: unknown): Promise<RecoveryLevel> {
    // L1-L5 escalation ladder. L1-L2 for now, L3-L5 wired in Phase 3 (compaction).
    return 'fail'
  }

  // ── Event helpers ──

  private makeEvent(task: AgentTask, type: SessionEvent['type'], payload: SessionEvent['payload']): SessionEvent {
    return {
      id: newId(),
      sessionId: task.sessionId,
      taskId: task.id,
      type,
      payload,
      createdAt: Date.now(),
    } as SessionEvent
  }

  private failEvent(task: AgentTask, error: string): SessionEvent {
    return this.makeEvent(task, 'TaskFailed', { error, recoverable: false })
  }
}
