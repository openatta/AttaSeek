/**
 * execCommandHook — executes a shell command as a hook.
 *
 * Spawns the command with timeout, captures stdout/stderr,
 * and parses JSON output for structured results.
 */

import { exec as execAsync } from 'child_process'
import { promisify } from 'util'
import type { HookConfig, HookContext, HookResult } from './HookTypes'

const exec = promisify(execAsync)

export async function execCommandHook(
  hook: HookConfig,
  _ctx: HookContext,
): Promise<HookResult> {
  if (!hook.command) return {}

  try {
    const { stdout, stderr } = await exec(hook.command, {
      timeout: hook.timeoutMs || 30_000,
      maxBuffer: 1024 * 1024, // 1MB
      env: { ...process.env },
    })

    const output = stdout.trim()
    if (!output && stderr) {
      return { messages: [`[Hook: ${hook.id}] stderr: ${stderr.slice(0, 500)}`] }
    }

    // Try JSON parse for structured output
    try {
      const json = JSON.parse(output) as Record<string, unknown>
      return parseStructuredOutput(hook.id, json)
    } catch {
      // Plain text output — inject as system message
      const truncated = output.slice(0, 2000)
      return { messages: [`[Hook: ${hook.id}] ${truncated}`] }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Exit code 2 = blocking error
    if (message.includes('Command failed') && message.includes('exit code 2')) {
      return {
        preventContinuation: true,
        blocking: `Hook "${hook.id}" returned exit code 2`,
        messages: [message.slice(0, 500)],
      }
    }
    // Non-blocking: warn and continue
    console.warn(`[execCommandHook] hook "${hook.id}" failed:`, message)
    return { messages: [`[Hook: ${hook.id}] warning: ${message.slice(0, 200)}`] }
  }
}

function parseStructuredOutput(hookId: string, json: Record<string, unknown>): HookResult {
  const result: HookResult = {}

  // Standard hook JSON output fields
  if (typeof json.continue === 'boolean') result.preventContinuation = !json.continue
  if (typeof json.stopReason === 'string') result.blocking = json.stopReason
  if (typeof json.decision === 'string' && (json.decision === 'approve' || json.decision === 'block')) {
    result.decision = json.decision
  }
  if (typeof json.systemMessage === 'string') {
    result.messages = [`[Hook: ${hookId}] ${json.systemMessage}`]
  }
  if (typeof json.suppressOutput === 'boolean') result.suppressOutput = json.suppressOutput

  return result
}
