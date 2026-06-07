/** AskUserQuestion tool manifest — ask the user a question and return their answer. */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'allow' as const, requirePreview: false, allowAlways: false }

export const QUESTION_TOOLS: ToolManifest[] = [
  {
    id: 'ask_user_question',
    pluginId: 'builtin',
    name: 'Ask User',
    description: 'Ask the user a question and wait for their answer. Supports optional predefined options for constrained responses.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question to ask the user' },
        options: { type: 'array', items: { type: 'string' }, description: 'Optional predefined answer options' },
      },
      required: ['question'],
    },
    outputSchema,
    category: 'communication',
    permissionPolicy,
  },
]
