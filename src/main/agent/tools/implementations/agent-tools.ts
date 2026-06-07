/** Agent tool manifest — spawn a sub-agent for focused task execution. */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'ask' as const, requirePreview: true, allowAlways: false }

export const AGENT_TOOLS: ToolManifest[] = [
  {
    id: 'spawn_agent',
    pluginId: 'builtin',
    name: 'Spawn Agent',
    description: 'Spawn a sub-agent to handle a focused task independently. The sub-agent runs with isolated context and returns a summary. Available profiles: coding, research, writing.',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'The task goal for the sub-agent' },
        profile_id: { type: 'string', enum: ['coding', 'research', 'writing'], description: 'Agent profile to use (default: coding)' },
      },
      required: ['goal'],
    },
    outputSchema,
    category: 'automation',
    permissionPolicy,
  },
]
