/**
 * MultiAgentCoordinator — shared interface for multi-agent coordination strategies.
 *
 * Implemented by CoordinatorMode (LLM-driven decompose + dependency-graph execution)
 * and SwarmManager (manual teammate management with sendMessage/TaskStop).
 */

import type { Subtask, CoordinatorResult } from './CoordinatorMode'
import type { AgentTask } from '../../../shared/types/AgentTask'
import type { AgentProfile } from '../profile/AgentProfile'
import type { SubAgentResult } from '../subagent/SubAgentManager'
import type { Teammate, SendMessageResult } from './SwarmManager'

/**
 * Common operations shared across all multi-agent coordination strategies.
 */
export interface MultiAgentCoordinator {
  /** Spawn a new worker for a specific goal. Returns the result or worker handle. */
  spawnWorker(
    parentTask: AgentTask,
    profile: AgentProfile,
    goal: string,
    options?: { name?: string; background?: boolean },
  ): Promise<SubAgentResult>

  /** Stop a running worker. */
  stopWorker(agentId: string): boolean

  /** List all active workers. */
  listWorkers(): Array<{ agentId: string; goal: string; status: string }>

  /** Cancel all workers. */
  cancelAll(): void
}

// ── Re-export coordination types for convenience ──

export type { Subtask, CoordinatorResult } from './CoordinatorMode'
export type { Teammate, TeamConfig, SendMessageResult } from './SwarmManager'
