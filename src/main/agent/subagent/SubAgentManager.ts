/**
 * SubAgentManager — Sub-agent lifecycle management.
 *
 * Creates, forks, resumes, and cancels sub-agents. Each sub-agent
 * runs an independent AgentOrchestrator with isolated context.
 *
 * Inspired by Claude Code's AgentTool + runAgent + forkSubagent.
 */

import { AgentOrchestrator } from '../orchestrator/AgentOrchestrator'
import type { AgentTask } from '../../../shared/types/AgentTask'
import type { AgentProfile } from '../profile/AgentProfile'
import type { SubAgentContext } from './SubAgentContext'
import type { SessionEvent } from '../../../shared/types/SessionEvent'

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

export class SubAgentManager {
  private agents = new Map<string, { orchestrator: AgentOrchestrator; info: SubAgentInfo }>()
  private nextId = 1

  /** Fork a new sub-agent */
  async fork(
    parentTask: AgentTask,
    profile: AgentProfile,
    goal: string,
    context: SubAgentContext,
  ): Promise<SubAgentResult> {
    const agentId = `subagent_${this.nextId++}`
    const orchestrator = new AgentOrchestrator()

    const task: AgentTask = {
      id: agentId,
      sessionId: parentTask.sessionId,
      projectId: parentTask.projectId,
      goal,
      status: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const info: SubAgentInfo = {
      agentId,
      agentType: profile.id,
      goal,
      status: 'running',
      startedAt: Date.now(),
    }

    this.agents.set(agentId, { orchestrator, info })

    const events: SessionEvent[] = []
    try {
      for await (const event of orchestrator.submitMessage(task, profile)) {
        events.push(event)
      }
      info.status = info.status === 'cancelled' ? 'cancelled' : 'completed'
    } catch (err) {
      info.status = 'failed'
      info.errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.warn(`[SubAgentManager] agent ${agentId} failed:`, info.errorMessage)
    } finally {
      // Clean up completed/failed/cancelled agents after 5 minutes
      setTimeout(() => this.agents.delete(agentId), 300_000)
    }

    return {
      agentId,
      summary: goal,
      events,
      status: info.status as SubAgentResult['status'],
      errorMessage: info.errorMessage,
    }
  }

  /** Cancel a sub-agent */
  cancel(agentId: string): void {
    const entry = this.agents.get(agentId)
    if (entry) {
      entry.orchestrator.interrupt()
      entry.info.status = 'cancelled'
    }
  }

  /** Cancel all running sub-agents */
  cancelAll(): void {
    for (const [, entry] of this.agents) {
      if (entry.info.status === 'running') {
        entry.orchestrator.interrupt()
        entry.info.status = 'cancelled'
      }
    }
  }

  /** List all sub-agents */
  list(): SubAgentInfo[] {
    return Array.from(this.agents.values()).map(e => e.info)
  }

  /** Get a specific sub-agent */
  get(agentId: string): SubAgentInfo | undefined {
    return this.agents.get(agentId)?.info
  }
}

export const subAgentManager = new SubAgentManager()
