/** Skill tool manifest — invoke a registered skill/slash-command. */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'allow' as const, requirePreview: false, allowAlways: false }

export const SKILL_TOOLS: ToolManifest[] = [
  {
    id: 'invoke_skill',
    pluginId: 'builtin',
    name: 'Invoke Skill',
    description: 'Invoke a registered skill by ID. Returns the skill plan, verification rules, and required tools for execution.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        skill_id: { type: 'string', description: 'ID of the skill to invoke' },
      },
      required: ['skill_id'],
    },
    outputSchema,
    category: 'automation',
    permissionPolicy,
  },
]
