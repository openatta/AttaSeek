/** Agent tool manifest — spawn a sub-agent for focused task execution.
 *
 * Supports:
 *   - 7 built-in sub-agent types: explore, plan, review, verify, coding, research, writing
 *   - Background async execution (run_in_background)
 *   - Named workers (addressable via send_message)
 *   - Worktree isolation
 *   - Model override per worker
 *
 * Aligned with Claude Code's AgentTool schema.
 */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'ask' as const, requirePreview: true, allowAlways: false }

export const AGENT_TOOLS: ToolManifest[] = [
  {
    id: 'spawn_agent',
    pluginId: 'builtin',
    name: 'Spawn Agent',
    description:
      'Launch a new agent to handle complex, multi-step tasks. Each agent type has specific capabilities and tools available to it.\n\n' +
      'Available agent types:\n' +
      '- explore: Read-only search agent for broad fan-out searches\n' +
      '- plan: Planning agent for designing implementation approaches\n' +
      '- review: Code review agent across 5 dimensions (correctness, readability, architecture, security, performance)\n' +
      '- verify: Adversarial verification agent — proves code actually works\n' +
      '- coding: Full software engineering agent (read, write, execute, test)\n' +
      '- research: Multi-source research agent (web search, deep reads)\n' +
      '- writing: Documentation and content writing agent\n' +
      '- general: Catch-all for any task that doesn\'t fit a more specific agent type',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'A short (3-5 word) description of the task',
        },
        goal: {
          type: 'string',
          description: 'The task for the agent to perform. Must be self-contained — workers cannot see your conversation. Include file paths, line numbers, and specific instructions.',
        },
        subagent_type: {
          type: 'string',
          enum: ['explore', 'plan', 'review', 'verify', 'coding', 'research', 'writing', 'general'],
          description: 'The type of specialized agent to use for this task',
        },
        model: {
          type: 'string',
          enum: ['sonnet', 'opus', 'haiku'],
          description: 'Optional model override for this agent. Takes precedence over the agent definition\'s model. If omitted, uses the default.',
        },
        run_in_background: {
          type: 'boolean',
          description: 'Set to true to run this agent in the background. You will be notified when it completes via <task-notification>.',
        },
        name: {
          type: 'string',
          description: 'Name for this worker. Makes it addressable via send_message(to: name) while running.',
        },
        isolation: {
          type: 'string',
          enum: ['inline', 'worktree'],
          description: 'Isolation mode. "worktree" creates a temporary git worktree so the agent works on an isolated copy of the repo.',
        },
        permission_mode: {
          type: 'string',
          enum: ['default', 'plan', 'acceptEdits'],
          description:
            "Permission mode for this worker (optional, defaults to 'default').\n" +
            "- default: Follow the worker profile's default permission policy\n" +
            '- plan: Worker must get plan approval before making changes (plan mode)\n' +
            '- acceptEdits: Worker can auto-accept edits without confirmation',
        },
      },
      required: ['goal'],
    },
    outputSchema,
    category: 'automation',
    permissionPolicy,
  },
]
