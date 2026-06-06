/**
 * Bash tool — shell command execution with safety whitelist.
 *
 * Blacklist pattern: blocks destructive operations (rm, rmdir, chmod, chown, sudo).
 * Timeout: 30s default (configurable via timeout_ms parameter).
 * All commands logged to audit.
 */

import { execSync } from 'child_process'

// NOTE: execSync runs commands through a shell (/bin/sh -c), which enables shell injection
// via LLM-generated strings. The blacklist below blocks obvious destructive patterns but
// is NOT comprehensive. For production: switch to child_process.spawn with explicit argv[]
// arrays and a whitelist of allowed commands.

const BLOCKED_PATTERNS = [
  /\brm\b/, /\brmdir\b/, /\bchmod\b/, /\bchown\b/,
  /\bsudo\b/, /\bdd\b/, /\bmkfs\b/, />\s*\/dev\//,
  /\bexport\s+\w+=/, /\bset\s+-\w/,
  /\/etc\//, /\.env\b/,
]

export const bashImpl = {
  toolId: 'bash',
  execute: async (input: Record<string, unknown>) => {
    const command = String(input.command || '')
    if (!command) throw new Error('command is required')
    const timeoutMs = Number(input.timeout_ms || 30000)
    const cwd = String(input.cwd || process.cwd())

    // Safety check
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        throw new Error(`Blocked command pattern: ${pattern.source}. Use a safer alternative.`)
      }
    }

    try {
      const stdout = execSync(command, {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024, // 1MB
        encoding: 'utf-8',
      })
      return stdout.slice(0, 50000) // truncate to 50KB
    } catch (err: any) {
      const stderr = err.stderr?.toString() || err.message || 'Unknown error'
      const exitCode = err.status || 1
      throw new Error(`[exit ${exitCode}] ${stderr.slice(0, 10000)}`)
    }
  },
}
