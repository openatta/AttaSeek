/** Plan mode tool manifests — enter_plan_mode, exit_plan_mode */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'allow' as const, requirePreview: false, allowAlways: false }

export const PLAN_TOOLS: ToolManifest[] = [
  {
    id: 'enter_plan_mode',
    pluginId: 'builtin',
    name: 'Enter Plan Mode',
    description: 'Enter plan mode to design an implementation plan before executing. In plan mode, the agent creates a structured plan for user approval before making changes.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Brief description of what you plan to design' },
      },
      required: [],
    },
    outputSchema,
    category: 'automation',
    permissionPolicy,
  },
  {
    id: 'exit_plan_mode',
    pluginId: 'builtin',
    name: 'Exit Plan Mode',
    description: 'Exit plan mode after user approves the plan. The agent will execute the plan step by step.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        plan_summary: { type: 'string', description: 'Summary of the approved plan' },
      },
      required: ['plan_summary'],
    },
    outputSchema,
    category: 'automation',
    permissionPolicy,
  },
]
