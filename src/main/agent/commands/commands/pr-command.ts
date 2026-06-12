/**
 * /pr command — generate a pull request description from git history.
 *
 * Usage:
 *   /pr              → show diff summary, ask LLM to generate PR description
 *   /pr <base>       → compare against specific base branch (e.g., /pr main)
 *
 * Returns shouldQuery: true with git log + diff injected, so the LLM
 * generates the PR body.
 */

import { execSync } from 'child_process'
import type { SlashCommand } from '../CommandRegistry'

export const prCommand: SlashCommand = {
  name: 'pr',
  description: 'Generate a pull request description from git history',

  execute(args: string, ctx) {
    const base = args.trim() || 'main'

    let logOutput: string
    let diffOutput: string

    try {
      logOutput = execSync(`git log ${base}..HEAD --oneline --no-color`, {
        cwd: ctx.cwd, stdio: 'pipe', timeout: 5000,
      }).toString().trim() || '(no commits ahead of base)'
    } catch {
      logOutput = '(could not determine base branch — is this a git repo?)'
    }

    try {
      diffOutput = execSync(`git diff ${base}...HEAD --stat --no-color`, {
        cwd: ctx.cwd, stdio: 'pipe', timeout: 10000,
      }).toString().trim() || '(no diff)'
    } catch {
      diffOutput = '(could not get diff)'
    }

    const currentBranch = (() => {
      try {
        return execSync('git branch --show-current', { cwd: ctx.cwd, stdio: 'pipe', timeout: 3000 }).toString().trim()
      } catch { return 'unknown' }
    })()

    const promptMsg = [
      'Generate a pull request description for the following changes.',
      'Include:',
      '1. A clear title',
      '2. Summary of what changed',
      '3. Testing notes',
      '4. Any breaking changes or deployment notes',
      '',
      `**Branch:** \`${currentBranch}\` → \`${base}\``,
      '',
      '**Commits:**',
      '```',
      logOutput,
      '```',
      '',
      '**Changed files:**',
      '```',
      diffOutput,
      '```',
    ].join('\n')

    return {
      messages: [{ role: 'user' as const, content: promptMsg }],
      shouldQuery: true,
      resultText: 'Generating PR description from branch history...',
    }
  },
}
