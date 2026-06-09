/**
 * SwarmManager — Multi-agent teammate orchestration.
 *
 * Manages a team of sub-agents ("teammates") that can communicate via
 * SendMessage and be stopped via TaskStop. Teammates share a team name
 * and memory scope but have independent query loops.
 *
 * Mirrors Claude Code's swarm coordination in src/utils/swarm/ and
 * the coordinatorMode's multi-agent orchestration.
 */

import { subAgentManager } from '../subagent/SubAgentManager'
import { createParentTask, createSubAgentContext } from '../subagent/SubAgentContext'
import type { AgentProfile } from '../profile/AgentProfile'
import { createSpawnProfile, createReplyProfile } from '../profile/factories'
import type { SubAgentResult } from '../subagent/SubAgentManager'

// ── Types ──

export interface Teammate {
  id: string
  name: string
  teamName: string
  color: string
  goal: string
  status: 'running' | 'completed' | 'error' | 'stopped'
  startedAt: number
  completedAt?: number
  result?: SubAgentResult
  errorMessage?: string
}

export interface TeamConfig {
  name: string
  color: string
  goals: string[]
}

export interface SendMessageResult {
  agentId: string
  response: string
}

// ── Implementation ──

export class SwarmManager {
  private teammates = new Map<string, Teammate>()
  private teamColors = new Map<string, string>()

  /** Spawn a teammate agent that runs in the background. */
  async spawnTeammate(
    teamName: string,
    name: string,
    goal: string,
    color?: string,
  ): Promise<Teammate> {
    const agentId = `teammate_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const assignedColor = color || this.getNextColor(teamName)

    const teammate: Teammate = {
      id: agentId,
      name,
      teamName,
      color: assignedColor,
      goal,
      status: 'running',
      startedAt: Date.now(),
    }
    this.teammates.set(agentId, teammate)

    const parentTask = createParentTask({ taskId: agentId, sessionId: `swarm_${teamName}` })
    const profile = createSpawnProfile(name, goal)
    const context = createSubAgentContext(goal, [], 'inline')

    // Spawn as background sub-agent
    subAgentManager.fork(parentTask, profile, goal, context)
      .then(result => {
        teammate.status = result.status === 'completed' ? 'completed' : 'error'
        teammate.completedAt = Date.now()
        teammate.result = result
        if (result.errorMessage) {
          teammate.errorMessage = result.errorMessage
        }
      }).catch(err => {
        teammate.status = 'error'
        teammate.completedAt = Date.now()
        teammate.errorMessage = (err as Error).message
      })

    return teammate
  }

  /** Send a message to a running teammate and get a response. */
  async sendMessage(agentId: string, message: string): Promise<SendMessageResult | null> {
    const teammate = this.teammates.get(agentId)
    if (!teammate || teammate.status !== 'running') return null

    // Use continueWorker for keep-alive workers, fall back to new fork
    const parentTask = createParentTask({
      taskId: `${agentId}_reply`,
      sessionId: `swarm_${teammate.teamName}`,
    })

    // Try continueWorker first (preserves context if in keep-alive)
    const response = await subAgentManager.continueWorker(agentId, message, parentTask)

    return {
      agentId,
      response: response.summary || response.status,
    }
  }

  /** Stop a teammate by ID. */
  stopTeammate(agentId: string): boolean {
    const teammate = this.teammates.get(agentId)
    if (!teammate) return false
    subAgentManager.cancel(agentId)
    teammate.status = 'stopped'
    teammate.completedAt = Date.now()
    return true
  }

  /** List all teammates in a team. */
  listTeam(teamName: string): Teammate[] {
    return Array.from(this.teammates.values())
      .filter(t => t.teamName === teamName)
  }

  /** List all active teammates. */
  listAll(): Teammate[] {
    return Array.from(this.teammates.values())
  }

  // ── Helpers ──

  private getNextColor(teamName: string): string {
    const existing = this.teamColors.get(teamName)
    if (existing) return existing
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
    const color = colors[this.teamColors.size % colors.length]
    this.teamColors.set(teamName, color)
    return color
  }
}

/** Singleton instance. */
export const swarmManager = new SwarmManager()
