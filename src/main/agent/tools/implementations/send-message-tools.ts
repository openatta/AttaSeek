/** SendMessage tool manifest — send follow-up messages to running/completed workers. */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'allow' as const, requirePreview: false, allowAlways: false }

export const SEND_MESSAGE_TOOLS: ToolManifest[] = [
  {
    id: 'send_message',
    pluginId: 'builtin',
    name: 'Send Message',
    description:
      'Send a follow-up message to continue a worker agent. ' +
      'Use this to give a worker additional instructions, corrections, or new tasks ' +
      'while keeping its loaded context. Workers are addressed by their agentId ' +
      '(from spawn_agent result) or name.',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient worker agentId (from spawn_agent result) or name.',
        },
        summary: {
          type: 'string',
          description: 'A 5-10 word summary shown as a preview in the UI (optional).',
        },
        message: {
          type: 'string',
          description: 'The message to send — self-contained follow-up instruction or correction.',
        },
        message_type: {
          type: 'string',
          enum: ['message', 'plan_approval', 'shutdown_request', 'shutdown_response'],
          description:
            'Type of structured message (optional, defaults to "message").\n' +
            '- message: Standard follow-up instruction\n' +
            '- plan_approval: Approve the worker\'s plan so it can proceed with implementation\n' +
            '- shutdown_request: Ask the worker to finish and shut down gracefully\n' +
            '- shutdown_response: Worker\'s response to a shutdown request',
        },
      },
      required: ['to', 'message'],
    },
    outputSchema,
    category: 'automation',
    permissionPolicy,
  },
]
