/**
 * AgentTool — sub-agent spawning tool implementation.
 *
 * Lets the LLM spawn sub-agents with isolated context for focused tasks.
 * Supports synchronous (fork) and asynchronous (forkAsync) execution.
 *
 * Aligned with Claude Code's AgentTool pattern.
 *
 * Input fields:
 *   - goal (required): Complete task description
 *   - description: 3-5 word task summary (shown in notifications)
 *   - subagent_type: Worker profile (explore|plan|review|verify|coding|research|writing|general)
 *   - model: Optional model override
 *   - run_in_background: Async execution with task notification
 *   - name: Worker name for send_message addressing
 *   - isolation: 'inline' (default) | 'worktree'
 */

import { subAgentManager } from '../../subagent/SubAgentManager'
import { createSubAgentContext, createParentTask } from '../../subagent/SubAgentContext'
import { codingProfile } from '../../profile/profiles/coding-profile'
import { researchProfile } from '../../profile/profiles/research-profile'
import { writingProfile } from '../../profile/profiles/writing-profile'
import { exploreAgentProfile } from '../../subagent/built-in/explore-agent'
import { planAgentProfile } from '../../subagent/built-in/plan-agent'
import { reviewAgentProfile } from '../../subagent/built-in/review-agent'
import { verifyAgentProfile } from '../../subagent/built-in/verify-agent'
import type { AgentProfile } from '../../profile/AgentProfile'
import type { ToolExecContext } from '../../../tools/ToolImplementations'

/** Map subagent_type values to AgentProfile instances. */
const PROFILE_MAP: Record<string, AgentProfile> = {
  explore: exploreAgentProfile,
  plan: planAgentProfile,
  review: reviewAgentProfile,
  verify: verifyAgentProfile,
  coding: codingProfile,
  research: researchProfile,
  writing: writingProfile,
}

export const spawnAgentImpl = {
  toolId: 'spawn_agent',
  execute: async (input: Record<string, unknown>, ctx?: ToolExecContext) => {
    const goal = String(input.goal || '')
    if (!goal) throw new Error('goal is required')

    const subagentType = String(input.subagent_type || 'coding')
    const profile = PROFILE_MAP[subagentType] || PROFILE_MAP['coding']
    if (!PROFILE_MAP[subagentType]) {
      throw new Error(
        `Unknown subagent_type: "${subagentType}". ` +
        `Available: ${Object.keys(PROFILE_MAP).join(', ')}`
      )
    }

    const description = String(input.description || goal.slice(0, 60))
    const runInBackground = Boolean(input.run_in_background)
    const workerName = input.name ? String(input.name) : undefined
    const isolation = (input.isolation === 'worktree' ? 'worktree' : 'inline') as 'inline' | 'worktree'
    const permissionMode = (['default', 'plan', 'acceptEdits'] as const).includes(
      String(input.permission_mode || 'default') as 'default' | 'plan' | 'acceptEdits',
    ) ? String(input.permission_mode || 'default') as 'default' | 'plan' | 'acceptEdits' : 'default'
    const parentTask = createParentTask(ctx)

    // Apply model override to profile if specified
    let effectiveProfile = profile
    if (input.model) {
      effectiveProfile = { ...profile, id: `${profile.id}_${input.model}` }
    }

    // Apply permission mode to profile
    if (permissionMode !== 'default') {
      effectiveProfile = {
        ...effectiveProfile,
        // Tag the profile id so permission checks can distinguish modes
        id: `${effectiveProfile.id}_pm_${permissionMode}`,
        // Plan mode: require explicit plan before making changes
        execution: {
          ...effectiveProfile.execution,
          planning: permissionMode === 'plan' ? 'inline' as const : effectiveProfile.execution.planning,
        },
      }
    }

    const context = createSubAgentContext(goal, [], isolation)

    // ── Context inheritance: if parent messages are available (coordinator mode),
    // use forkWithContext to give the worker visibility into the coordinator's reasoning.
    const hasParentContext = ctx?.parentMessages && ctx.parentMessages.length > 0

    // ── Background (async) execution ──
    if (runInBackground) {
      // forkAsync doesn't support forkWithContext yet — use fork() + background promise
      // for context-inherited workers, or fall back to forkAsync for non-inherited.
      if (hasParentContext) {
        // Fire-and-forget with context inheritance
        const resultPromise = subAgentManager.forkWithContext(
          parentTask, effectiveProfile, goal, context, ctx!.parentMessages,
        )
        // Don't await — return immediately like forkAsync
        resultPromise.then(result => {
          if (result.status === 'failed') {
            console.warn(`[spawn_agent] background worker with context failed: ${result.errorMessage}`)
          }
        }).catch(err => {
          console.warn(`[spawn_agent] background worker with context error:`, err)
        })
        return [
          `Launched background agent (with parent context):`,
          `  Description: ${description}`,
          `  Profile: ${subagentType}${workerName ? ` (${workerName})` : ''}${permissionMode !== 'default' ? ` [${permissionMode}]` : ''}`,
          ``,
          `The agent will run in the background. Results will arrive as <task-notification> messages when complete.`,
          workerName ? `Use send_message(to: "${workerName}") to continue this agent.` : '',
        ].filter(Boolean).join('\n')
      }

      const { agentId, status, outputFile } = await subAgentManager.forkAsync(
        parentTask, effectiveProfile, goal, context,
      )
      return [
        `Launched background agent:`,
        `  Agent ID: ${agentId}`,
        `  Status: ${status}`,
        `  Description: ${description}`,
        `  Profile: ${subagentType}${workerName ? ` (${workerName})` : ''}${permissionMode !== 'default' ? ` [${permissionMode}]` : ''}`,
        outputFile ? `  Output: ${outputFile}` : '',
        ``,
        `The agent will run in the background. Results will arrive as <task-notification> messages when complete.`,
        workerName ? `Use send_message(to: "${agentId}") to continue this agent.` : '',
      ].filter(Boolean).join('\n')
    }

    // ── Synchronous execution ──
    const result = hasParentContext
      ? await subAgentManager.forkWithContext(parentTask, effectiveProfile, goal, context, ctx!.parentMessages)
      : await subAgentManager.fork(parentTask, effectiveProfile, goal, context)

    const lines = [
      `Sub-agent ${result.agentId} (${subagentType} profile)${hasParentContext ? ' [inherited parent context]' : ''}${permissionMode !== 'default' ? ` [${permissionMode}]` : ''}`,
      `Status: ${result.status}`,
      `Events: ${result.events.length}`,
      result.status === 'failed' && result.errorMessage ? `Error: ${result.errorMessage}` : '',
      `Summary: ${result.summary}`,
    ]
    return lines.filter(Boolean).join('\n')
  },
}
