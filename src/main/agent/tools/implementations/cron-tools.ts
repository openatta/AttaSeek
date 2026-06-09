/**
 * Cron tool definitions and implementations.
 *
 * Three tools:
 *   CronCreate  — schedule a recurring or one-shot prompt
 *   CronDelete  — remove a scheduled job by ID
 *   CronList    — list all active cron jobs
 *
 * Mirrors Claude Code's CronCreate/CronDelete/CronList tools.
 */

import { cronScheduler } from '../../CronScheduler'
import type { ToolManifest } from '../../../../shared/types/Tool'

// ── Tool manifests ──

export const cronCreateManifest: ToolManifest = {
  id: 'cron_create',
  pluginId: 'attaseek',
  name: 'CronCreate',
  description: 'Schedule a prompt to be enqueued at a future time. Use for both recurring schedules and one-shot reminders. Uses standard 5-field cron in the user\'s local timezone: minute hour day-of-month month day-of-week. "0 9 * * *" means 9am local.',
  outputSchema: { type: 'object', properties: { id: { type: 'string' }, message: { type: 'string' } } },
  inputSchema: {
    type: 'object',
    properties: {
      cron: { type: 'string', description: '5-field cron expression in local time: "M H DoM Mon DoW" (e.g. "*/5 * * * *" = every 5 min).' },
      prompt: { type: 'string', description: 'The prompt to enqueue at each fire time.' },
      recurring: { type: 'boolean', description: 'true (default) = fire on every cron match. false = fire once at the next match, then auto-delete.' },
    },
    required: ['cron', 'prompt'],
  },
  riskLevel: 'write',
  category: 'automation',
  permissionPolicy: { default: 'ask', requirePreview: false, allowAlways: false },
}

export const cronDeleteManifest: ToolManifest = {
  id: 'cron_delete',
  pluginId: 'attaseek',
  name: 'CronDelete',
  description: 'Cancel a cron job previously scheduled with CronCreate.',
  outputSchema: { type: 'object', properties: { message: { type: 'string' } } },
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Job ID returned by CronCreate.' },
    },
    required: ['id'],
  },
  riskLevel: 'write',
  category: 'automation',
  permissionPolicy: { default: 'allow', requirePreview: false, allowAlways: true },
}

export const cronListManifest: ToolManifest = {
  id: 'cron_list',
  pluginId: 'attaseek',
  name: 'CronList',
  description: 'List all cron jobs scheduled via CronCreate in this session.',
  outputSchema: { type: 'array', items: { type: 'object' } },
  inputSchema: { type: 'object', properties: {} },
  riskLevel: 'read',
  category: 'automation',
  permissionPolicy: { default: 'allow', requirePreview: false, allowAlways: true },
}

// ── Implementations ──

export async function cronCreateImpl(input: Record<string, unknown>): Promise<{ output: string; success: boolean }> {
  const cron = String(input.cron || '')
  const prompt = String(input.prompt || '')
  const recurring = input.recurring !== false

  if (!cron.trim()) {
    return { output: 'Error: cron expression is required', success: false }
  }
  if (!prompt.trim()) {
    return { output: 'Error: prompt is required', success: false }
  }

  const result = cronScheduler.create(cron.trim(), prompt.trim(), recurring)
  if (result.error) {
    return { output: `Error: ${result.error}`, success: false }
  }

  const job = cronScheduler.get(result.id)
  const nextFire = job ? new Date(job.nextFireAt).toISOString() : 'unknown'
  const type = recurring ? 'recurring' : 'one-shot'

  return {
    output: JSON.stringify({
      id: result.id,
      cron,
      prompt: prompt.slice(0, 100),
      recurring,
      type,
      nextFireAt: nextFire,
      message: `${type} job scheduled. Next fire: ${nextFire}`,
    }),
    success: true,
  }
}

export async function cronDeleteImpl(input: Record<string, unknown>): Promise<{ output: string; success: boolean }> {
  const id = String(input.id || '')
  if (!id) {
    return { output: 'Error: job ID is required', success: false }
  }

  const existed = cronScheduler.delete(id)
  return {
    output: existed ? `Job "${id}" deleted.` : `Job "${id}" not found.`,
    success: existed,
  }
}

export async function cronListImpl(_input: Record<string, unknown>): Promise<{ output: string; success: boolean }> {
  const jobs = cronScheduler.list()
  if (jobs.length === 0) {
    return { output: 'No scheduled cron jobs.', success: true }
  }

  const list = jobs.map(j => ({
    id: j.id,
    cron: j.cron,
    prompt: j.prompt.slice(0, 80),
    recurring: j.recurring,
    nextFireAt: new Date(j.nextFireAt).toISOString(),
    createdAt: new Date(j.createdAt).toISOString(),
    lastFiredAt: j.lastFiredAt ? new Date(j.lastFiredAt).toISOString() : null,
  }))

  return { output: JSON.stringify(list, null, 2), success: true }
}
