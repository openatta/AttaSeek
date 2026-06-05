/**
 * AgentLoop — the real LLM-driven agent execution loop.
 *
 * Replaces the mock transition table in AgentRuntime with:
 *   ContextBuilder.build() → LLMProvider.chatStream() → ToolExecutor.execute() → loop
 *
 * Flow:
 *   User Input → ContextBuilder → LLM (streaming) →
 *     text_delta → AgentMessageChunk events →
 *     tool_use   → ToolCallStarted → ToolExecutor → ToolCallFinished →
 *     end_turn   → Artifact → Memory → Audit → TaskCompleted
 */

import type { AgentTask } from '../../renderer/core/types/AgentTask'
import { agentEventBus } from './AgentEventBus'
import { contextBuilder } from './ContextBuilder'
import { llmProviderRegistry, extractProviderConfig, LLMError } from './LLMProvider'
import { toolExecutor } from '../tools/ToolExecutor'
import { artifactService } from '../artifacts/ArtifactService'
import { memoryService } from '../memory/MemoryService'
import { auditService } from '../audit/AuditService'
import { newId } from '../store/id'
import { perf, checkTarget } from '../perf'
import { modelUsageTracker } from '../model/ModelUsageTracker'
import { modelConfigService } from '../model/ModelConfigService'
import type { LLMContentBlock, LLMToolUseBlock } from './LLMProvider'

// Throttle streaming chunks to avoid IPC flood (50ms ≈ 20 events/sec max)
const CHUNK_THROTTLE_MS = 50

export class AgentLoop {
  private abortControllers = new Map<string, AbortController>()

  /** Start the agent loop for a task */
  async run(task: AgentTask): Promise<void> {
    const provider = task.modelConfigId
      ? llmProviderRegistry.getById(task.modelConfigId)
      : llmProviderRegistry.getDefault()

    if (!provider) {
      this.failTask(task, 'No LLM provider configured. Please set an API key in Settings.')
      return
    }

    const controller = new AbortController()
    this.abortControllers.set(task.id, controller)

    try {
      // ── Phase 1-3: Context Assembly, Skill Selection, Planning ──
      task.status = 'context_assembling'
      task.updatedAt = Date.now()

      const ctx = await contextBuilder.build({
        goal: task.goal,
        sessionId: task.sessionId,
        projectId: task.projectId,
      })

      task.status = 'skill_selecting'
      task.updatedAt = Date.now()

      task.status = 'planning'
      task.updatedAt = Date.now()

      // Build provider config from model config extraParams
      const modelConfig = modelConfigService.get(task.modelConfigId || llmProviderRegistry.getDefaultId() || '')
      const providerConfig = modelConfig ? extractProviderConfig(modelConfig.extraParams) : {}

      // ── Phase 4: Execute Tool Loop ──
      const loopResult = await this.executeToolLoop(task, ctx, provider, providerConfig, controller)
      if (task.status !== 'executing') return // cancelled or denied

      // ── Phase 5-8: Artifact, Verify, Memory, Complete ──
      await this.finalizeTask(task, provider, loopResult.toolUseCount, loopResult.totalInputTokens, loopResult.totalOutputTokens)
    } catch (err) {
      if (controller.signal.aborted) return
      const message = err instanceof Error ? err.message : 'Unknown error'
      this.failTask(task, message)
    } finally {
      this.abortControllers.delete(task.id)
    }
  }

  /** Phase 4: Run the main tool-execution loop. Returns accumulated counters. */
  private async executeToolLoop(
    task: AgentTask,
    ctx: import('./ContextBuilder').AssembledContext,
    provider: import('./LLMProvider').LLMProvider,
    providerConfig: import('./LLMProvider').LLMProviderConfig,
    controller: AbortController,
  ): Promise<{ toolUseCount: number; totalInputTokens: number; totalOutputTokens: number }> {
    task.status = 'executing'
    task.updatedAt = Date.now()

    let messages = ctx.messages
    let toolUseCount = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let toolResults_: { id: string; output: unknown }[] = []
    const MAX_TOOL_ROUNDS = 10

    while (task.status === 'executing' && toolUseCount < MAX_TOOL_ROUNDS) {
      if (controller.signal.aborted) {
        task.status = 'cancelled'
        break
      }

      const messageId = `msg_${newId().slice(0, 8)}`

      agentEventBus.emit({
        id: newId(), sessionId: task.sessionId, taskId: task.id,
        type: 'AgentMessage', payload: { content: '' }, createdAt: Date.now(),
      })

      const result = await provider.chatStream(
        { systemPrompt: ctx.systemPrompt, messages, tools: ctx.tools, config: providerConfig },
        (chunk) => this.handleChunk(task, chunk, messageId),
      )

      totalInputTokens += result.usage.inputTokens
      totalOutputTokens += result.usage.outputTokens
      this.flushChunk(task, messageId, true)

      if (result.stopReason === 'end_turn' || result.stopReason === 'max_tokens') break

      const toolUses = result.content.filter(
        (b): b is LLMToolUseBlock => b.type === 'tool_use',
      )
      if (toolUses.length === 0) break

      for (const toolUse of toolUses) {
        if (controller.signal.aborted) break

        const toolCallId = `tc_${newId().slice(0, 8)}`
        agentEventBus.emit({
          id: newId(), sessionId: task.sessionId, taskId: task.id,
          type: 'ToolCallStarted',
          payload: {
            toolCallId, toolId: toolUse.name, toolName: toolUse.name,
            input: toolUse.input, riskLevel: 'read',
          },
          createdAt: Date.now(),
        })

        const execResult = await toolExecutor.execute({
          toolId: toolUse.name,
          toolCallId,
          input: (toolUse.input || {}) as Record<string, unknown>,
          taskId: task.id,
          sessionId: task.sessionId,
          projectId: task.projectId,
        })

        toolResults_.push({ id: toolUse.id, output: execResult.output })

        agentEventBus.emit({
          id: newId(), sessionId: task.sessionId, taskId: task.id,
          type: 'ToolCallFinished',
          payload: {
            toolCallId, toolId: toolUse.name, toolName: toolUse.name,
            output: execResult.output, status: execResult.success ? 'success' : 'error',
            error: execResult.error?.message, duration: 0,
          },
          createdAt: Date.now(),
        })

        if (execResult.permissionDecision === 'deny') {
          task.status = 'denied'
          break
        }
        toolUseCount++
      }

      // Append assistant + tool results to message history for next LLM turn
      if (task.status === 'executing') {
        const assistantBlocks = result.content.filter((b) => b.type === 'text' || b.type === 'tool_use')
        messages.push({ role: 'assistant', content: assistantBlocks as LLMContentBlock[] })

        const toolResults: LLMContentBlock[] = toolResults_.map((tr) => ({
          type: 'tool_result' as const,
          tool_use_id: tr.id,
          content: typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output).slice(0, 4000),
        }))
        if (toolResults.length > 0) messages.push({ role: 'user', content: toolResults })
        toolResults_ = []
      }
    }

    return { toolUseCount, totalInputTokens, totalOutputTokens }
  }

  /** Phase 5-8: Generate artifact, verify, write memory, complete task, auto-title, track usage. */
  private async finalizeTask(
    task: AgentTask,
    provider: import('./LLMProvider').LLMProvider,
    toolUseCount: number,
    totalInputTokens: number,
    totalOutputTokens: number,
  ): Promise<void> {
    // Phase 5: Generate Artifact
    task.status = 'generating_artifact'
    task.updatedAt = Date.now()

    const lastAgentEvent = agentEventBus
      .getHistoryByType(task.sessionId, 'AgentMessage')
      .pop()
    if (lastAgentEvent) {
      const payload = lastAgentEvent.payload as { content: string }
      if (payload.content) {
        const artifact = artifactService.create({
          sessionId: task.sessionId,
          taskId: task.id,
          type: 'markdown',
          title: task.goal.slice(0, 80),
          content: payload.content,
        })
        task.artifactRefs = [artifact.id]
      }
    }

    // Phase 6: Verify
    task.status = 'verifying'
    task.updatedAt = Date.now()

    // Phase 7: Write Memory
    task.status = 'writing_memory'
    task.updatedAt = Date.now()
    memoryService.store({
      scope: 'project',
      scopeId: task.projectId || task.sessionId,
      type: 'task_state',
      content: `Completed: ${task.goal}`,
      source: `task:${task.id}`,
      sessionId: task.sessionId,
      taskId: task.id,
    })

    // Phase 8: Complete
    const totalDuration = Date.now() - task.createdAt
    task.status = 'completed'
    task.updatedAt = Date.now()

    perf.mark('agent', 'task-duration', totalDuration)
    checkTarget('ipcInvokeP95', totalDuration)

    await this.autoTitle(task, provider)
    this.recordUsage(task, provider, toolUseCount, totalInputTokens, totalOutputTokens, totalDuration)

    auditService.log({
      taskId: task.id, sessionId: task.sessionId, projectId: task.projectId,
      eventType: 'agent_task_completed',
    })
  }

  /** Generate a session title from the first task goal (best-effort). */
  private async autoTitle(task: AgentTask, provider: import('./LLMProvider').LLMProvider): Promise<void> {
    const isFirstTask = !agentEventBus.getHistory(task.sessionId).some((e) => e.type === 'SessionTitleGenerated')
    if (!isFirstTask) return
    try {
      const titleResult = await provider.chat({
        systemPrompt: 'Generate a concise 3-5 word title for this conversation. Reply ONLY with the title, no quotes or extra text.',
        messages: [{ role: 'user', content: task.goal }],
        tools: [],
        config: { maxTokens: 50 },
      })
      const titleText = titleResult.content.find((b) => b.type === 'text') as { text: string } | undefined
      if (titleText?.text) {
        const title = titleText.text.trim().slice(0, 80)
        agentEventBus.emit({
          id: newId(), sessionId: task.sessionId, taskId: task.id,
          type: 'SessionTitleGenerated', payload: { title }, createdAt: Date.now(),
        })
      }
    } catch { /* title generation is best-effort */ }
  }

  /** Record token usage to the usage tracker and emit TaskCompleted event. */
  private recordUsage(
    task: AgentTask,
    provider: import('./LLMProvider').LLMProvider,
    toolUseCount: number,
    totalInputTokens: number,
    totalOutputTokens: number,
    totalDuration: number,
  ): void {
    const usedProviderId = task.modelConfigId || llmProviderRegistry.getDefaultId()
    if (usedProviderId) {
      modelUsageTracker.record({
        configId: usedProviderId,
        sessionId: task.sessionId,
        taskId: task.id,
        model: task.modelName || provider.models[0] || 'unknown',
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      })
    }

    agentEventBus.emit({
      id: newId(), sessionId: task.sessionId, taskId: task.id,
      type: 'TaskCompleted',
      payload: {
        summary: `Completed: ${task.goal}`,
        artifactCount: task.artifactRefs?.length || 0,
        toolCallCount: toolUseCount,
        duration: totalDuration,
      },
      createdAt: Date.now(),
    })
  }

  /** Cancel a running task */
  cancel(taskId: string): void {
    const controller = this.abortControllers.get(taskId)
    if (controller) {
      controller.abort()
      this.abortControllers.delete(taskId)
    }
  }

  // ── Private: streaming chunk handler ──

  private chunkBuffer = new Map<string, { text: string; lastEmit: number }>()

  private handleChunk(
    task: AgentTask,
    chunk: import('./LLMProvider').LLMChunk,
    messageId: string,
  ): void {
    if (chunk.type !== 'text_delta') return

    // Throttle: buffer chunks and emit at CHUNK_THROTTLE_MS intervals
    const key = `${task.sessionId}:${task.id}:${messageId}`
    const buf = this.chunkBuffer.get(key) || { text: '', lastEmit: 0 }
    buf.text += chunk.text

    const now = Date.now()
    if (now - buf.lastEmit >= CHUNK_THROTTLE_MS) {
      agentEventBus.emit({
        id: newId(), sessionId: task.sessionId, taskId: task.id,
        type: 'AgentMessageChunk',
        payload: { content: buf.text, isFinal: false, messageId },
        createdAt: now,
      })
      buf.text = ''
      buf.lastEmit = now
    }
    this.chunkBuffer.set(key, buf)
  }

  /** Flush remaining chunk buffer. If isFinal=true, marks the message complete. */
  private flushChunk(task: AgentTask, messageId: string, isFinal = false): void {
    const key = `${task.sessionId}:${task.id}:${messageId}`
    const buf = this.chunkBuffer.get(key)
    if (buf && buf.text) {
      agentEventBus.emit({
        id: newId(), sessionId: task.sessionId, taskId: task.id,
        type: 'AgentMessageChunk',
        payload: { content: buf.text, isFinal, messageId },
        createdAt: Date.now(),
      })
    } else if (isFinal) {
      // No buffered text, but still need to signal completion
      agentEventBus.emit({
        id: newId(), sessionId: task.sessionId, taskId: task.id,
        type: 'AgentMessageChunk',
        payload: { content: '', isFinal: true, messageId },
        createdAt: Date.now(),
      })
    }
    this.chunkBuffer.delete(key)
  }

  // ── Private: error handling ──

  private failTask(task: AgentTask, error: string): void {
    task.status = 'failed'
    task.errorMessage = error
    task.updatedAt = Date.now()

    // Flush any remaining streaming chunks as final content
    const prefix = `${task.sessionId}:${task.id}:`
    const keys = Array.from(this.chunkBuffer.keys()).filter((k) => k.startsWith(prefix))
    for (const key of keys) {
      const msgId = key.slice(prefix.length)
      if (msgId) this.flushChunk(task, msgId)
    }

    agentEventBus.emit({
      id: newId(), sessionId: task.sessionId, taskId: task.id,
      type: 'TaskFailed',
      payload: { error, recoverable: true },
      createdAt: Date.now(),
    })

    auditService.log({
      taskId: task.id, sessionId: task.sessionId, projectId: task.projectId,
      eventType: 'agent_task_failed',
    })
  }
}

/** Singleton */
export const agentLoop = new AgentLoop()
