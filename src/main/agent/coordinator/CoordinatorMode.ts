/**
 * CoordinatorMode — Leader/Worker multi-agent coordination.
 *
 * Leader decomposes complex tasks, forks Workers, collects results,
 * and synthesizes the final output.
 *
 * Inspired by Claude Code's coordinatorMode + Workflow system.
 *
 * Phase 3: LLM-driven decompose replaces MVP single-subtask fallback.
 * Falls back to MVP behavior when compact model is unavailable.
 */

import { subAgentManager } from '../subagent/SubAgentManager'
import type { SubAgentResult } from '../subagent/SubAgentManager'
import { taskDecomposer } from './TaskDecomposer'
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

export class CoordinatorMode {
  /**
   * Decompose goal into subtasks via LLM (delegated to TaskDecomposer).
   *
   * Falls back to MVP single-subtask when LLM is unavailable
   * or the decomposition fails.
   */
  async decompose(task: AgentTask): Promise<Subtask[]> {
    const result = await taskDecomposer.decompose(task.goal)
    if (result) return result

    // Fallback: single subtask (MVP behavior)
    return this.fallbackDecompose(task)
  }

  /** Execute all subtasks, respecting dependencies. */
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
        .filter(
          ({ subtask, index }) =>
            !completed.has(index) &&
            (subtask.dependsOn || []).every((d) => completed.has(d)),
        )

      if (ready.length === 0) break

      // Execute ready subtasks in parallel
      const batchResults = await Promise.all(
        ready.map(({ subtask, index }) => this.executeSubtask(subtask, index, parentTask, profiles)),
      )

      for (const r of batchResults) {
        completed.add(r.index)
        results.push(r.result)
      }
    }

    return {
      summary: `Completed ${results.filter((r) => r.status === 'completed').length}/${subtasks.length} subtasks`,
      subtaskResults: results,
      events: allEvents,
    }
  }

  // ── Private helpers ──

  /** Execute a single subtask via SubAgentManager. */
  private async executeSubtask(
    subtask: Subtask,
    index: number,
    parentTask: AgentTask,
    profiles: Map<string, AgentProfile>,
  ): Promise<{ result: SubAgentResult; index: number }> {
    const profile = profiles.get(subtask.profileId)
    if (!profile) {
      return {
        result: {
          agentId: '', summary: '', events: [],
          status: 'failed',
          errorMessage: `Unknown profile: ${subtask.profileId}`,
        },
        index,
      }
    }

    try {
      const result = await subAgentManager.fork(
        parentTask, profile, subtask.goal,
        { sharedFileTree: [], sharedMemories: [], parentSummary: parentTask.goal, isolation: 'inline' },
      )
      return { result, index }
    } catch (err) {
      return {
        result: {
          agentId: 'error', summary: '', events: [],
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        },
        index,
      }
    }
  }

  /** MVP fallback: wrap the goal as a single subtask. */
  private fallbackDecompose(task: AgentTask): Subtask[] {
    return [
      {
        title: task.goal.slice(0, 60),
        goal: task.goal,
        profileId: 'coding',
      },
    ]
  }
}

export const coordinatorMode = new CoordinatorMode()
