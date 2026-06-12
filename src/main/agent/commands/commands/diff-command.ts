/**
 * /diff command — show git diff for the current workspace.
 *
 * Usage:
 *   /diff           → show unstaged diff
 *   /diff staged    → show staged diff
 *   /diff <file>    → show diff for specific file
 *
 * This is a local command: shouldQuery is false, output is direct.
 * For AI-powered diff review, use /review instead.
 */

import { execSync } from 'child_process'
import type { SlashCommand } from '../CommandRegistry'

function gitDiff(cwd: string, staged: boolean, file?: string): string {
  try {
    const args = ['diff']
    if (staged) args.push('--staged')
    args.push('--color=never')
    if (file) args.push('--', file)
    const out = execSync(`git ${args.join(' ')}`, { cwd, stdio: 'pipe', timeout: 10000, maxBuffer: 512 * 1024 }).toString()
    return out || '(no changes)'
  } catch (err) {
    return `❌ Failed to get diff: ${err instanceof Error ? err.message : String(err)}`
  }
}

function gitChangedFiles(cwd: string): string {
  try {
    return execSync('git status --short', { cwd, stdio: 'pipe', timeout: 5000 }).toString() || '(clean)'
  } catch {
    return '(not a git repository?)'
  }
}

export const diffCommand: SlashCommand = {
  name: 'diff',
  description: 'Show git diff for the current workspace',
  aliases: ['d'],

  execute(args: string, ctx) {
    const trimmed = args.trim().toLowerCase()
    let diffOutput: string
    let title: string

    if (trimmed === 'staged') {
      diffOutput = gitDiff(ctx.cwd, true)
      title = 'Staged Diff'
    } else if (trimmed === 'files' || trimmed === 'stat' || trimmed === 'status') {
      const files = gitChangedFiles(ctx.cwd)
      return {
        messages: [],
        shouldQuery: false,
        resultText: `**Changed files:**\n\n\`\`\`\n${files}\n\`\`\``,
      }
    } else if (trimmed) {
      diffOutput = gitDiff(ctx.cwd, false, trimmed)
      title = `Diff: ${trimmed}`
    } else {
      diffOutput = gitDiff(ctx.cwd, false)
      title = 'Unstaged Diff'
    }

    const maxLen = 80_000
    const truncated = diffOutput.length > maxLen
      ? diffOutput.slice(0, maxLen) + '\n\n... (truncated)'
      : diffOutput

    return {
      messages: [],
      shouldQuery: false,
      resultText: `**${title}**\n\n\`\`\`diff\n${truncated}\n\`\`\``,
    }
  },
}
