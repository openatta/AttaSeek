/**
 * /review command — request an AI code review of changed files.
 *
 * Usage:
 *   /review              → review unstaged changes
 *   /review staged       → review staged changes
 *   /review <file>       → review a specific file's changes
 *   /review all          → review all project code (not just diff)
 *
 * Returns shouldQuery: true with the diff/content injected, so the LLM
 * performs the review. The review checks for:
 * - Bugs and correctness issues
 * - Security vulnerabilities
 * - Performance problems
 * - Code style and readability
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import type { SlashCommand } from '../CommandRegistry'

const MAX_DIFF_SIZE = 100_000

function getDiff(cwd: string, staged: boolean, targetFile?: string): string {
  try {
    const args = ['diff']
    if (staged) args.push('--staged')
    args.push('--no-color', '--unified=5')
    if (targetFile) args.push('--', targetFile)
    const out = execSync(`git ${args.join(' ')}`, { cwd, stdio: 'pipe', timeout: 15000, maxBuffer: 512 * 1024 }).toString()
    return out || '(no changes)'
  } catch (err) {
    return `Could not get diff: ${err instanceof Error ? err.message : String(err)}`
  }
}

function getProjectFiles(cwd: string): string {
  try {
    // List tracked files (top 50 by recent modification)
    const out = execSync(
      'git ls-files --modified --others --exclude-standard | head -30',
      { cwd, stdio: 'pipe', timeout: 5000 },
    ).toString().trim()
    if (!out) return '(no tracked files found — not a git repo?)'

    const files = out.split('\n').slice(0, 10)
    const contents: string[] = []
    for (const f of files) {
      const fp = join(cwd, f)
      try {
        if (existsSync(fp) && statSync(fp).isFile() && statSync(fp).size < 50000) {
          const content = readFileSync(fp, 'utf-8')
          contents.push(`### ${f}\n\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\``)
        }
      } catch { /* skip unreadable files */ }
    }
    return contents.join('\n\n') || '(no readable source files)'
  } catch {
    return '(could not list project files)'
  }
}

export const reviewCommand: SlashCommand = {
  name: 'review',
  description: 'Review code changes for bugs, security, and style issues',
  aliases: ['rv'],

  execute(args: string, ctx) {
    const trimmed = args.trim().toLowerCase()

    let reviewTarget: string
    let reviewLabel: string

    if (!trimmed) {
      // Unstaged diff
      reviewTarget = getDiff(ctx.cwd, false)
      reviewLabel = 'unstaged changes'
    } else if (trimmed === 'staged') {
      // Staged diff
      reviewTarget = getDiff(ctx.cwd, true)
      reviewLabel = 'staged changes'
    } else if (trimmed === 'all') {
      // Full project review
      reviewTarget = getProjectFiles(ctx.cwd)
      reviewLabel = 'recently modified files'
    } else {
      // Specific file
      reviewTarget = getDiff(ctx.cwd, false, trimmed) || getDiff(ctx.cwd, true, trimmed)
      reviewLabel = `file: ${trimmed}`
    }

    const truncated = reviewTarget.length > MAX_DIFF_SIZE
      ? reviewTarget.slice(0, MAX_DIFF_SIZE) + '\n\n... (truncated for length)'
      : reviewTarget

    const promptMsg = [
      'Review the following code changes for:',
      '',
      '1. **Bugs** — logic errors, null reference issues, race conditions',
      '2. **Security** — injection vectors, hardcoded secrets, unsafe API usage',
      '3. **Performance** — N+1 queries, unnecessary allocations, blocking calls',
      '4. **Style** — naming inconsistencies, missing error handling, code duplication',
      '',
      'Format your review as:',
      '- Critical issues (must fix)',
      '- Important issues (should fix)',
      '- Nit/suggestions',
      '',
      `**Review target:** ${reviewLabel}`,
      '',
      truncated ? '```diff\n' + truncated + '\n```' : '(no changes to review)',
    ].join('\n')

    return {
      messages: [{ role: 'user' as const, content: promptMsg }],
      shouldQuery: true,
      resultText: `Reviewing ${reviewLabel}...`,
    }
  },
}
