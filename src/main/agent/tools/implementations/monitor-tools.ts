/**
 * Monitor tool definition and implementation.
 *
 * Starts a background monitor that streams events from a long-running
 * script. Each stdout line becomes a notification in the conversation.
 *
 * Mirrors Claude Code's Monitor tool pattern.
 */

import { monitorManager } from '../../MonitorManager'
import type { ToolManifest } from '../../../../shared/types/Tool'

// ── Tool manifest ──

export const monitorManifest: ToolManifest = {
  id: 'monitor',
  pluginId: 'attaseek',
  name: 'Monitor',
  description: 'Start a background monitor that streams events from a long-running script. Each stdout line is an event — the agent keeps working and notifications arrive in the chat.',
  outputSchema: { type: 'object', properties: { id: { type: 'string' }, message: { type: 'string' } } },
  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Short human-readable description of what you are monitoring (shown in notifications).' },
      command: { type: 'string', description: 'Shell command or script. Each stdout line is an event; exit ends the watch.' },
      timeout_ms: { type: 'number', description: 'Kill the monitor after this deadline. Default 300000ms, max 3600000ms. Ignored when persistent is true.' },
      persistent: { type: 'boolean', description: 'Run for the lifetime of the session (no timeout). Use for session-length watches like log tails.' },
    },
    required: ['description', 'command'],
  },
  riskLevel: 'write',
  category: 'automation',
  permissionPolicy: { default: 'ask', requirePreview: false, allowAlways: false },
}

// ── Implementation ──

export async function monitorImpl(input: Record<string, unknown>): Promise<{ output: string; success: boolean }> {
  const description = String(input.description || 'Background monitor')
  const command = String(input.command || '')
  const persistent = input.persistent === true
  const timeoutMs = typeof input.timeout_ms === 'number' ? input.timeout_ms : 300_000

  if (!command.trim()) {
    return { output: 'Error: command is required', success: false }
  }

  const result = monitorManager.start(command.trim(), description, persistent, timeoutMs)
  if (result.error) {
    return { output: `Error: ${result.error}`, success: false }
  }

  return {
    output: JSON.stringify({
      id: result.id,
      description,
      command: command.slice(0, 200),
      persistent,
      message: persistent
        ? `Monitor "${description}" started (persistent — runs until TaskStop). ID: ${result.id}`
        : `Monitor "${description}" started (timeout: ${timeoutMs}ms). ID: ${result.id}`,
    }),
    success: true,
  }
}
