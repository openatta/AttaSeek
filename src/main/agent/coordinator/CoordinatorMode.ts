/**
 * CoordinatorMode — Leader/Worker multi-agent coordination.
 *
 * Leader decomposes complex tasks, forks Workers, collects results,
 * and synthesizes the final output.
 *
 * Inspired by Claude Code's coordinatorMode + Workflow system.
 */

import { subAgentManager } from '../subagent/SubAgentManager'
import type { AgentProfile } from '../profile/AgentProfile'
import type { AgentTask } from '../../../shared/types/AgentTask'
import type { SessionEvent } from '../../../shared/types/SessionEvent'

export interface Subtask {
  title: string
  goal: string
  profileId: string
  dependsOn?: number[] // indices of subtasks this depends on
}

export interface CoordinatorResult {
  summary: string
  subtaskResults: SubAgentResult[]
  events: SessionEvent[]
}

interface SubAgentResult {
  subtask: Subtask
  agentId: string
  status: 'completed' | 'failed' | 'cancelled'
  summary: string
  errorMessage?: string
}

export class CoordinatorMode {
  /** Decompose goal into subtasks via LLM */
  async decompose(task: AgentTask, profile: AgentProfile): Promise<Subtask[]> {
    // In production: LLM call to analyze goal and produce subtask list
    // For MVP: return single subtask
    return [{
      title: task.goal,
      goal: task.goal,
      profileId: profile.id,
    }]
  }

  /** Execute all subtasks, respecting dependencies */
  async execute(
    parentTask: AgentTask,
    subtasks: Subtask[],
    profiles: Map<string, AgentProfile>,
  ): Promise<CoordinatorResult> {
    const results: SubAgentResult[] = []
    const completed = new Set<number>()
    const allEvents: SessionEvent[] = []

    while (completed.size < subtasks.length) {
      const ready = subtasks
        .map((st, i) => ({ subtask: st, index: i }))
        .filter(({ subtask, index }) =>
          !completed.has(index) &&
          (subtask.dependsOn || []).every(d => completed.has(d)),
        )

      if (ready.length === 0) break

      // Execute ready subtasks in parallel
      const batchResults = await Promise.all(ready.map(async ({ subtask, index }) => {
        const profile = profiles.get(subtask.profileId)
        if (!profile) return { subtask, index, status: 'failed' as const, summary: '', agentId: '', errorMessage: `Unknown profile: ${subtask.profileId}` }

        const result = await subAgentManager.fork(parentTask, profile, subtask.goal, {
          sharedFileTree: [],
          sharedMemories: [],
          parentSummary: parentTask.goal,
          isolation: 'inline',
        })

        return { subtask, index, status: result.status, summary: result.summary, agentId: result.agentId, errorMessage: result.errorMessage }
      }))

      for (const r of batchResults) {
        completed.add(r.index)
        results.push({ subtask: r.subtask, agentId: r.agentId, status: r.status, summary: r.summary, errorMessage: r.errorMessage })
      }
    }

    return {
      summary: `Completed ${results.filter(r => r.status === 'completed').length}/${subtasks.length} subtasks`,
      subtaskResults: results,
      events: allEvents,
    }
  }
}

export const coordinatorMode = new CoordinatorMode()
