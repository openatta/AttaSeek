/** Task management tool manifests — task_create, task_update, task_list, task_output. */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'allow' as const, requirePreview: false, allowAlways: false }

export const TASK_MGMT_TOOLS: ToolManifest[] = [
  {
    id: 'task_create',
    pluginId: 'builtin',
    name: 'Task Create',
    description: 'Create a new tracked task with a subject and description.',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Task title / subject' },
        description: { type: 'string', description: 'Task goal or detailed description' },
        sessionId: { type: 'string', description: 'Owning session ID' },
      },
      required: ['subject'],
    },
    outputSchema,
    category: 'automation',
    permissionPolicy,
  },
  {
    id: 'task_update',
    pluginId: 'builtin',
    name: 'Task Update',
    description: 'Update the status or title of an existing task.',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to update' },
        status: { type: 'string', description: 'New status' },
        title: { type: 'string', description: 'New title' },
      },
      required: ['taskId'],
    },
    outputSchema,
    category: 'automation',
    permissionPolicy,
  },
  {
    id: 'task_list',
    pluginId: 'builtin',
    name: 'Task List',
    description: 'List all tracked tasks with their statuses.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    outputSchema,
    category: 'automation',
    permissionPolicy,
  },
  {
    id: 'task_output',
    pluginId: 'builtin',
    name: 'Task Output',
    description: 'Retrieve the output of a completed task.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to retrieve output for' },
      },
      required: ['taskId'],
    },
    outputSchema,
    category: 'automation',
    permissionPolicy,
  },
]
