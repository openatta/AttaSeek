/**
 * SubAgentManager — Sub-agent lifecycle management.
 *
 * Creates, forks, resumes, and cancels sub-agents. Each sub-agent
 * runs an independent QueryEngine with isolated context.
 *
 * Inspired by Claude Code's AgentTool + runAgent + forkSubagent.
 */

import { QueryEngine } from '../orchestrator/QueryEngine'
import type { LLMMessage } from '../llm/ModelProvider'
import { recursionGuard } from './RecursionGuard'
import { hookPipeline } from '../hooks/HookPipeline'
import { agentEventBus } from '../AgentEventBus'
import { taskNotificationQueue } from '../TaskNotificationQueue'
import { newId } from '../../store/id'
import type { AgentTask } from '../../../shared/types/AgentTask'
import type { AgentProfile } from '../profile/AgentProfile'
import type { SubAgentContext } from './SubAgentContext'
import type { SessionEvent } from '../../../shared/types/SessionEvent'
import { createContinuationProfile } from '../profile/factories'
import { SUBAGENT_IDLE_CLEANUP_MS, SUBAGENT_OUTPUT_DIR } from '../../../shared/constants'

/** Maximum concurrent async sub-agents to prevent runaway spawning. */
const MAX_CONCURRENT_ASYNC = 10

/** TTL for keep-alive workers — engine preserved for continuation after completion. */
const KEEP_ALIVE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Maximum keep-alive workers before oldest is evicted. */
const MAX_KEEP_ALIVE_WORKERS = 3

export interface SubAgentInfo {
  agentId: string
  agentType: string
  goal: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  errorMessage?: string
  startedAt: number
}

export interface SubAgentResult {
  agentId: string
  summary: string
  events: SessionEvent[]
  status: 'completed' | 'failed' | 'cancelled'
  errorMessage?: string
}

/** Result returned by forkAsync — immediate, before the sub-agent completes. */
export interface AsyncForkResult {
  agentId: string
  status: 'async_launched'
  /** Path where the sub-agent's output is persisted (for reading progress). */
  outputFile: string
  /** Whether the calling agent has Read/Bash tools to check output files. */
  canReadOutputFile: boolean
}

/** Internal agent record stored in the agents Map. */
interface AgentEntry {
  engine: QueryEngine
  info: SubAgentInfo
  cleanupTimer?: ReturnType<typeof setTimeout>
  backgroundPromise?: Promise<void>
  /** Keep-alive: worker completed but engine preserved for continuation. */
  keepAlive?: boolean
  /** Unix ms timestamp when keep-alive expires. */
  keepAliveUntil?: number
  /** Accumulated events from the worker's execution (for context continuity). */
  events?: SessionEvent[]
  /** The profile used for this worker (for continuation). */
  profile?: AgentProfile
}

/** Shared setup result returned by createAgentEngine. */
interface AgentSetup {
  agentId: string
  task: AgentTask
  engine: QueryEngine
  info: SubAgentInfo
  worktreePath: string | undefined
}

export class SubAgentManager {
  private agents = new Map<string, AgentEntry>()
  private nextId = 1

  // ── Public API ──

  /** Fork a new sub-agent and wait for completion. */
  async fork(
    parentTask: AgentTask,
    profile: AgentProfile,
    goal: string,
    context: SubAgentContext,
  ): Promise<SubAgentResult> {
    const guard = recursionGuard.enter(profile.id)
    if (!guard.allowed) {
      return {
        agentId: 'rejected', summary: guard.message!,
        events: [], status: 'failed', errorMessage: guard.message,
      }
    }

    const setup = await this.createAgentEngine(agentId(), parentTask, profile, goal, context)
    this.emitSubagentHook('SubagentStart', parentTask, profile, setup.agentId, goal)

    const { events } = await this.executeAgentLoop(
      setup.agentId, setup.engine, setup.task, profile, goal, setup.worktreePath,
    )

    // Enter keep-alive: preserve engine for continuation, evict oldest if at capacity
    const entry = this.agents.get(setup.agentId)
    if (entry && setup.info.status === 'completed') {
      entry.events = events
      entry.profile = profile
      this.enterKeepAlive(entry)
    }

    this.emitSubagentHook('SubagentStop', parentTask, profile, setup.agentId, goal, setup.info.status as 'completed' | 'failed' | 'cancelled')
    return {
      agentId: setup.agentId, summary: goal, events,
      status: setup.info.status as SubAgentResult['status'],
      errorMessage: setup.info.errorMessage,
    }
  }

  /**
   * Fork a sub-agent that runs asynchronously in the background.
   * Returns immediately. Completion is delivered via TaskNotificationQueue.
   */
  async forkAsync(
    parentTask: AgentTask,
    profile: AgentProfile,
    goal: string,
    context: SubAgentContext,
  ): Promise<AsyncForkResult> {
    const guard = recursionGuard.enter(profile.id)
    if (!guard.allowed) {
      throw new Error(guard.message || 'Cannot fork: max recursion depth reached')
    }

    // Concurrency limit
    const runningCount = Array.from(this.agents.values())
      .filter(e => e.info.status === 'running').length
    if (runningCount >= MAX_CONCURRENT_ASYNC) {
      throw new Error(
        `Too many concurrent sub-agents (${runningCount}/${MAX_CONCURRENT_ASYNC}). ` +
        `Wait for some to complete before spawning more.`
      )
    }

    const setup = await this.createAgentEngine(agentId(), parentTask, profile, goal, context)
    this.emitSubagentHook('SubagentStart', parentTask, profile, setup.agentId, goal)

    const startedAt = Date.now()
    const backgroundPromise = this.runInBackground(
      setup.agentId, setup.engine, setup.task, profile, goal,
      parentTask, setup.worktreePath, startedAt,
    )

    const entry = this.agents.get(setup.agentId)
    if (entry) entry.backgroundPromise = backgroundPromise

    return {
      agentId: setup.agentId,
      status: 'async_launched',
      outputFile: `${SUBAGENT_OUTPUT_DIR}/${setup.agentId}.output`,
      canReadOutputFile: true,
    }
  }

  /** Cancel a sub-agent. */
  cancel(agentId: string): void {
    const entry = this.agents.get(agentId)
    if (!entry) return
    if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer)
    entry.engine.interrupt()
    entry.info.status = 'cancelled'
    // Clean up background promise reference (no-op if already resolved)
    entry.backgroundPromise = undefined
  }

  /** Cancel all running sub-agents. */
  cancelAll(): void {
    for (const [, entry] of this.agents) {
      if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer)
      if (entry.info.status === 'running') {
        entry.engine.interrupt()
        entry.info.status = 'cancelled'
      }
      entry.backgroundPromise = undefined
    }
  }

  /** List all sub-agents. */
  list(): SubAgentInfo[] {
    return Array.from(this.agents.values()).map(e => e.info)
  }

  /** Get a specific sub-agent. */
  get(agentId: string): SubAgentInfo | undefined {
    return this.agents.get(agentId)?.info
  }

  /**
   * Continue a worker by sending a follow-up message.
   *
   * If the worker is in keep-alive state, the message is injected directly
   * into its existing QueryEngine, preserving full conversation context.
   *
   * If the worker is running, the message is enqueued for the next iteration
   * (via spawn of continuation agent — MVP limitation).
   *
   * If the worker is neither, a fresh continuation agent is spawned.
   */
  async continueWorker(
    agentId: string,
    message: string,
    parentTask: AgentTask,
  ): Promise<SubAgentResult> {
    const entry = this.agents.get(agentId)

    // Path 1: Worker is in keep-alive — inject directly (preserves context)
    if (entry?.keepAlive && entry.profile) {
      const result = await this.injectAndContinue(agentId, message, parentTask)
      if (result) return result
      // Fall through to path 2 if injectAndContinue failed
    }

    // Path 2/3: Worker running, not found, or evicted — spawn fresh continuation
    const prevGoal = entry?.info.goal
    const prefix = prevGoal
      ? `(continuing work from agent "${agentId}" — previous goal: ${prevGoal.slice(0, 200)})\n\nFollow-up: ${message}`
      : `(continuation of agent "${agentId}")\n\nFollow-up: ${message}`
    return this.fork(parentTask, createContinuationProfile(), prefix, {
      sharedFileTree: [], sharedMemories: [], parentSummary: message, isolation: 'inline',
    })
  }

  /**
   * Fork a sub-agent with parent conversation context inheritance.
   *
   * Unlike fork(), the sub-agent receives the parent's messages (truncated to
   * keepRecentTurns) and rendered system prompt. This gives the sub-agent
   * visibility into the parent's reasoning chain — essential for coordination
   * scenarios where the worker needs to understand what the coordinator already
   * knows.
   *
   * Mirrors Claude Code's forkSubagent context inheritance pattern.
   */
  async forkWithContext(
    parentTask: AgentTask,
    profile: AgentProfile,
    goal: string,
    context: SubAgentContext,
    parentMessages?: LLMMessage[],
    keepRecentTurns = 10,
  ): Promise<SubAgentResult> {
    // Truncate parent messages to last N turns (each turn = user + assistant pair)
    let inheritedMessages: LLMMessage[] = []
    if (parentMessages && parentMessages.length > 0) {
      // Count assistant messages to determine turns
      const assistantIndices: number[] = []
      for (let i = 0; i < parentMessages.length; i++) {
        if (parentMessages[i]!.role === 'assistant') {
          assistantIndices.push(i)
        }
      }
      // Keep last N turns
      const startIdx = assistantIndices.length > keepRecentTurns
        ? (assistantIndices[assistantIndices.length - keepRecentTurns] ?? 0)
        : 0
      // Walk back to include the preceding user message
      let sliceStart = startIdx
      while (sliceStart > 0 && parentMessages[sliceStart - 1]?.role === 'user') {
        sliceStart--
      }
      inheritedMessages = parentMessages.slice(sliceStart)
    }

    return this.fork(parentTask, profile, goal, {
      ...context,
      parentMessages: inheritedMessages,
    })
  }

  /** Number of workers in keep-alive state. */
  get keepAliveCount(): number {
    return Array.from(this.agents.values()).filter(e => e.keepAlive && !this.isKeepAliveExpired(e)).length
  }

  /**
   * Inject a user message into a keep-alive worker's engine and run
   * another query loop iteration. Returns the result or null if the
   * worker is not in keep-alive.
   *
   * This is the true "continue" mechanism — the worker preserves its
   * conversation context across follow-up messages.
   */
  async injectAndContinue(
    agentId: string,
    message: string,
    parentTask: AgentTask,
  ): Promise<SubAgentResult | null> {
    const entry = this.agents.get(agentId)
    if (!entry?.keepAlive || !entry.profile) return null

    // Expire check — if TTL elapsed, clean up and refuse
    if (this.isKeepAliveExpired(entry)) {
      this.evictKeepAlive(entry, agentId)
      return null
    }

    // Cancel the keep-alive timer — the worker is being continued
    if (entry.cleanupTimer) {
      clearTimeout(entry.cleanupTimer)
      entry.cleanupTimer = undefined
    }
    entry.keepAlive = false
    entry.info.status = 'running'

    const events = entry.events || []
    try {
      for await (const event of entry.engine.submitMessage(message, parentTask, entry.profile)) {
        events.push(event)
      }
      entry.info.status = 'completed'
    } catch (err) {
      entry.info.status = 'failed'
      entry.info.errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.warn(`[SubAgentManager] injectAndContinue ${agentId} failed:`, entry.info.errorMessage)
    }

    // Re-enter keep-alive
    entry.events = events
    if (entry.info.status === 'completed') {
      this.enterKeepAlive(entry)
    }

    return {
      agentId,
      summary: message,
      events: events.slice(entry.events ? events.length - (entry.events.length || events.length) : 0),
      status: entry.info.status as SubAgentResult['status'],
      errorMessage: entry.info.errorMessage,
    }
  }

  // ── Private helpers ──

  /**
   * Enter keep-alive state: preserve the engine, set TTL, evict oldest if at capacity.
   */
  private enterKeepAlive(entry: AgentEntry): void {
    // Evict expired keep-alive workers first
    for (const [id, e] of this.agents) {
      if (e.keepAlive && this.isKeepAliveExpired(e)) {
        this.evictKeepAlive(e, id)
      }
    }

    // If still at capacity, evict the oldest keep-alive
    const aliveWorkers = Array.from(this.agents.entries())
      .filter(([, e]) => e.keepAlive)
    if (aliveWorkers.length >= MAX_KEEP_ALIVE_WORKERS) {
      // Sort by keepAliveUntil ascending — evict oldest
      aliveWorkers.sort(([, a], [, b]) => (a.keepAliveUntil || 0) - (b.keepAliveUntil || 0))
      const [oldestId] = aliveWorkers[0]!
      const oldestEntry = this.agents.get(oldestId)
      if (oldestEntry) this.evictKeepAlive(oldestEntry, oldestId)
    }

    entry.keepAlive = true
    entry.keepAliveUntil = Date.now() + KEEP_ALIVE_TTL_MS

    // Set the cleanup timer
    if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer)
    entry.cleanupTimer = setTimeout(() => {
      const current = this.agents.get(entry.info.agentId)
      if (current?.keepAlive) {
        this.evictKeepAlive(current, entry.info.agentId)
      }
    }, KEEP_ALIVE_TTL_MS)
  }

  /** Check if a keep-alive entry has expired. */
  private isKeepAliveExpired(entry: AgentEntry): boolean {
    return entry.keepAliveUntil ? Date.now() > entry.keepAliveUntil : false
  }

  /** Evict a keep-alive worker: destroy engine, remove from registry. */
  private evictKeepAlive(entry: AgentEntry, agentId: string): void {
    if (entry.cleanupTimer) {
      clearTimeout(entry.cleanupTimer)
      entry.cleanupTimer = undefined
    }
    entry.keepAlive = false
    entry.engine.interrupt()
    this.agents.delete(agentId)
  }

  /**
   * Create the shared engine/task/info setup for a new sub-agent.
   * Extracted from fork()/forkAsync() to eliminate ~50 lines of duplication.
   */
  private async createAgentEngine(
    agentId: string,
    parentTask: AgentTask,
    profile: AgentProfile,
    goal: string,
    context: SubAgentContext,
  ): Promise<AgentSetup> {
    let worktreePath: string | undefined
    if (context.isolation === 'worktree') {
      try {
        const { worktreeManager } = await import('./worktree/WorktreeManager')
        worktreePath = await worktreeManager.create(agentId)
      } catch (err) {
        console.warn(`[SubAgentManager] worktree creation failed for ${agentId}:`, err)
      }
    }
    // worktreePath is undefined for inline isolation — no import wasted

    const task: AgentTask = {
      id: agentId, sessionId: parentTask.sessionId,
      projectId: worktreePath || parentTask.projectId,
      goal, status: 'idle',
      createdAt: Date.now(), updatedAt: Date.now(),
    }

    const engine = new QueryEngine({
      sessionId: parentTask.sessionId,
      cwd: worktreePath,
      projectId: worktreePath || parentTask.projectId,
      modelSlot: 'subagent',
    })

    // Seed parent conversation context if provided (forkWithContext)
    if (context.parentMessages && context.parentMessages.length > 0) {
      engine.seedMessages(context.parentMessages)
    }

    const info: SubAgentInfo = {
      agentId, agentType: profile.id, goal,
      status: 'running', startedAt: Date.now(),
    }

    const cleanupTimer = setTimeout(() => this.agents.delete(agentId), SUBAGENT_IDLE_CLEANUP_MS)
    this.agents.set(agentId, { engine, info, cleanupTimer })

    return { agentId, task, engine, info, worktreePath }
  }

  /**
   * Execute the agent event loop (common to fork() and runInBackground()).
   * Runs engine.submitMessage(), tracks events and tool use count,
   * updates entry status, and cleans up.
   */
  private async executeAgentLoop(
    agentId: string,
    engine: QueryEngine,
    task: AgentTask,
    profile: AgentProfile,
    goal: string,
    worktreePath: string | undefined,
  ): Promise<{ events: SessionEvent[]; toolUseCount: number }> {
    const entry = this.agents.get(agentId)
    const events: SessionEvent[] = []
    let toolUseCount = 0
    if (!entry) return { events, toolUseCount }

    try {
      for await (const event of engine.submitMessage(goal, task, profile)) {
        events.push(event)
        if (event.type === 'ToolCallFinished') toolUseCount++
      }
      entry.info.status = 'completed'
    } catch (err) {
      entry.info.status = 'failed'
      entry.info.errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.warn(`[SubAgentManager] agent ${agentId} failed:`, entry.info.errorMessage)
    } finally {
      await this.cleanupAgent(agentId, worktreePath)
    }

    return { events, toolUseCount }
  }

  /** Emit a SubagentStart or SubagentStop hook (non-blocking). */
  private emitSubagentHook(
    phase: 'SubagentStart' | 'SubagentStop',
    parentTask: AgentTask,
    profile: AgentProfile,
    agentId: string,
    goal: string,
    status?: 'completed' | 'failed' | 'cancelled',
  ): void {
    try {
      hookPipeline.execute(phase, {
        task: parentTask, turnCount: 0, messages: [],
        lastAssistantContent: '', profileId: profile.id,
        subagentId: agentId, subagentProfile: profile.id, subagentGoal: goal,
        ...(status && { subagentStatus: status, subagentResult: goal }),
      })
    } catch { /* hook failure is non-blocking */ }
  }

  /** Clean up recursion guard and optional worktree after agent completion. */
  private async cleanupAgent(agentId: string, worktreePath?: string): Promise<void> {
    recursionGuard.exit()
    if (worktreePath) {
      try {
        const { worktreeManager } = await import('./worktree/WorktreeManager')
        await worktreeManager.discard(agentId)
      } catch { /* best effort */ }
    }
  }

  /** Background execution loop for forkAsync. */
  private async runInBackground(
    agentId: string,
    engine: QueryEngine,
    task: AgentTask,
    profile: AgentProfile,
    goal: string,
    parentTask: AgentTask,
    worktreePath: string | undefined,
    startedAt: number,
  ): Promise<void> {
    const entry = this.agents.get(agentId)
    if (!entry) return

    const { events, toolUseCount } = await this.executeAgentLoop(
      agentId, engine, task, profile, goal, worktreePath,
    )

    // Enter keep-alive for completed workers
    if (entry.info.status === 'completed') {
      entry.events = events
      entry.profile = profile
      this.enterKeepAlive(entry)
    }

    this.emitSubagentHook('SubagentStop', parentTask, profile, agentId, goal,
      entry.info.status as 'completed' | 'failed' | 'cancelled')

    const notificationPayload = {
      agentId,
      status: (entry.info.status === 'completed' ? 'completed' : 'failed') as 'completed' | 'failed',
      summary: entry.info.status === 'completed'
        ? `Agent "${profile.name}" completed`
        : `Agent "${profile.name}" failed: ${entry.info.errorMessage || 'Unknown error'}`,
      result: entry.info.status === 'completed' ? goal : (entry.info.errorMessage || 'Unknown error'),
      usage: {
        totalTokens: engine.getTotalUsage().inputTokens + engine.getTotalUsage().outputTokens,
        inputTokens: engine.getTotalUsage().inputTokens,
        outputTokens: engine.getTotalUsage().outputTokens,
        toolUses: toolUseCount,
        durationMs: Date.now() - startedAt,
      },
      errorMessage: entry.info.errorMessage,
      canReadOutputFile: true,
      outputFile: `${SUBAGENT_OUTPUT_DIR}/${agentId}.output`,
    }

    taskNotificationQueue.enqueue(task.sessionId, agentId, notificationPayload)
    agentEventBus.emitAsync({
      id: newId(), sessionId: task.sessionId, taskId: parentTask.id,
      type: 'TaskNotification', payload: notificationPayload, createdAt: Date.now(),
    } as SessionEvent)
  }
}

// ── Module-level helpers ──

function agentId(): string {
  return `subagent_${Math.random().toString(36).slice(2, 10)}`
}

export const subAgentManager = new SubAgentManager()
