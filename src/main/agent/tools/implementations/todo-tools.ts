/** TodoWrite tool manifest — structured todo list tracking */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'allow' as const, requirePreview: false, allowAlways: false }

export const TODO_TOOLS: ToolManifest[] = [
  {
    id: 'todo_write',
    pluginId: 'builtin',
    name: 'Todo Write',
    description: 'Create and manage a structured task list for tracking progress through complex multi-step tasks.',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              subject: { type: 'string', description: 'Task title' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'Task status' },
              description: { type: 'string', description: 'Optional detailed description' },
            },
            required: ['subject', 'status'],
          },
          description: 'Array of todo items with status',
        },
      },
      required: ['todos'],
    },
    outputSchema,
    category: 'automation',
    permissionPolicy,
  },
]
