/**
 * /commit command — stage and commit changes with an AI-generated message.
 *
 * Usage:
 *   /commit              → show staged/unstaged summary, ask LLM to generate message
 *   /commit "message"    → commit with the given message directly
 *
 * When called without a message, this command returns shouldQuery: true with
 * the git status injected, so the LLM can generate a commit message.
 * When called with a message, it commits directly (local-only).
 */

import { execSync } from 'child_process'
import type { SlashCommand } from '../CommandRegistry'

export const commitCommand: SlashCommand = {
  name: 'commit',
  description: 'Commit staged changes (with or without AI-generated message)',
  aliases: ['ci'],

  execute(args: string, ctx) {
    const trimmed = args.trim()

    // Direct commit with user-provided message
    if (trimmed) {
      try {
        // Strip quotes if provided
        const msg = trimmed.replace(/^["']|["']$/g, '')
        execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { cwd: ctx.cwd, stdio: 'pipe', timeout: 10000 })
        const hash = execSync('git rev-parse --short HEAD', { cwd: ctx.cwd, stdio: 'pipe', timeout: 3000 }).toString().trim()
        return {
          messages: [],
          shouldQuery: false,
          resultText: `✅ Committed: \`${hash}\` — "${msg}"`,
        }
      } catch (err) {
        return {
          messages: [],
          shouldQuery: false,
          resultText: `❌ Commit failed: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
    }

    // No message: get status and ask LLM to generate commit message
    let status: string
    try {
      status = execSync('git status', { cwd: ctx.cwd, stdio: 'pipe', timeout: 5000 }).toString()
    } catch {
      status = '(not a git repository?)'
    }

    const promptMsg = [
      'Generate a concise git commit message for the following changes.',
      'Follow the conventional commits format (feat:, fix:, refactor:, etc.).',
      'Output ONLY the commit message, nothing else.',
      '',
      '```',
      status.trim(),
      '```',
    ].join('\n')

    return {
      messages: [{ role: 'user' as const, content: promptMsg }],
      shouldQuery: true,
      resultText: 'Generating commit message from staged changes...',
    }
  },
}
