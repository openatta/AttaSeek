/**
 * AgentTool — sub-agent spawning tool.
 *
 * Lets the LLM spawn sub-agents with isolated context for focused tasks.
 * Uses SubAgentManager.fork() under the hood.
 *
 * Aligned with Claude Code's AgentTool pattern.
 */

import { subAgentManager } from '../../subagent/SubAgentManager'
import { createSubAgentContext } from '../../subagent/SubAgentContext'
import { codingProfile } from '../../profile/profiles/coding-profile'
import { researchProfile } from '../../profile/profiles/research-profile'
import { writingProfile } from '../../profile/profiles/writing-profile'
import type { AgentProfile } from '../../profile/AgentProfile'
import type { ToolExecContext } from '../../../tools/ToolImplementations'

const PROFILES: Record<string, AgentProfile> = {
  coding: codingProfile,
  research: researchProfile,
  writing: writingProfile,
}

export const spawnAgentImpl = {
  toolId: 'spawn_agent',
  execute: async (input: Record<string, unknown>, ctx?: ToolExecContext) => {
    const goal = String(input.goal || '')
    if (!goal) throw new Error('goal is required')

    const profileId = String(input.profile_id || 'coding')
    const profile = PROFILES[profileId]
    if (!profile) {
      throw new Error(`Unknown profile: ${profileId}. Available: ${Object.keys(PROFILES).join(', ')}`)
    }

    const parentTask = {
      id: ctx?.taskId || 'unknown',
      sessionId: ctx?.sessionId || 'default',
      projectId: ctx?.projectId,
      goal: 'parent task',
      status: 'idle' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const context = createSubAgentContext(goal, [], 'inline')
    const result = await subAgentManager.fork(parentTask, profile, goal, context)

    return [
      `Sub-agent ${result.agentId} (${profileId} profile)`,
      `Status: ${result.status}`,
      `Events: ${result.events.length}`,
      result.status === 'failed' && result.errorMessage ? `Error: ${result.errorMessage}` : '',
      `Summary: ${result.summary}`,
    ].filter(Boolean).join('\n')
  },
}
