/**
 * SendMessageTool — send follow-up messages to running/completed workers.
 *
 * MVP implementation: spawns a continuation sub-agent with context
 * reference to the original worker. Future iterations will support
 * direct message injection into a running worker's QueryEngine.
 *
 * Aligned with Claude Code's SendMessage Tool pattern.
 */

import { subAgentManager } from '../../subagent/SubAgentManager'
import { createParentTask } from '../../subagent/SubAgentContext'
import type { ToolExecContext } from '../../../tools/ToolImplementations'

export const sendMessageImpl = {
  toolId: 'send_message',
  execute: async (input: Record<string, unknown>, ctx?: ToolExecContext) => {
    const to = String(input.to || '').trim()
    if (!to) throw new Error('"to" is required — specify the recipient worker agentId')
    const message = String(input.message || '').trim()
    if (!message) throw new Error('"message" is required')
    const messageType = String(input.message_type || 'message') as
      'message' | 'plan_approval' | 'shutdown_request' | 'shutdown_response'

    const parentTask = createParentTask(ctx)

    // Prefix structured message types with a type tag that the worker can interpret
    const typePrefix = messageType !== 'message'
      ? `[${messageType.toUpperCase()}]\n`
      : ''

    try {
      const result = await subAgentManager.continueWorker(to, typePrefix + message, parentTask)
      return [
        `Message sent to "${to}"${messageType !== 'message' ? ` (${messageType})` : ''}.`,
        `Continuation agent: ${result.agentId}`,
        `Status: ${result.status}`,
        result.status === 'failed' && result.errorMessage ? `Error: ${result.errorMessage}` : '',
        `Response: ${result.summary}`,
      ].filter(Boolean).join('\n')
    } catch (err) {
      throw new Error(
        `Failed to send message to "${to}": ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  },
}
