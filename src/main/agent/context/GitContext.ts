/**
 * GitContext — memoized git repository status collector.
 *
 * Gathers the current git context (branch, status, recent commits, user name)
 * once per session and caches the result. Used by ContextAssembler to inject
 * a git status snapshot into the system prompt.
 *
 * Mirrors Claude Code's getGitStatus (src/context.ts).
 */

import { execSync } from 'child_process'
import type { ContextAssemblerConfig } from './ContextAssembler'

// ── Types ──

export interface GitState {
  /** Whether the current directory is inside a git repo. */
  isGit: boolean
  /** Current branch name. */
  branch: string
  /** Default/main branch name. */
  mainBranch: string
  /** `git status --short` output (truncated to maxStatusChars). */
  status: string
  /** Recent commit log (`git log --oneline -n N`). */
  recentCommits: string
  /** `git config user.name`. */
  userName: string
  /** Whether the status output was truncated. */
  statusTruncated: boolean
}

export interface GitContextConfig {
  /** Max characters for git status output. Default: 2000. */
  maxStatusChars: number
  /** Number of recent commits to include. Default: 5. */
  recentCommitCount: number
}

const DEFAULT_CONFIG: GitContextConfig = {
  maxStatusChars: 2000,
  recentCommitCount: 5,
}

// ── Memoized git state ──

let _cachedGitState: GitState | null = null
let _cachedCwd: string = ''

// ── Core ──

/**
 * Collect git context for the current working directory.
 * Result is memoized per cwd — subsequent calls with the same cwd
 * return the cached result without re-executing git commands.
 *
 * @param cwd — working directory (defaults to process.cwd())
 * @param config — optional overrides
 */
export function collectGitContext(
  cwd: string = process.cwd(),
  config: Partial<GitContextConfig> = {},
): GitState {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Return cached result if cwd hasn't changed
  if (_cachedCwd === cwd && _cachedGitState) {
    return _cachedGitState
  }

  _cachedCwd = cwd

  // Check if we're in a git repo
  let isGit = false
  try {
    execSync('git rev-parse --git-dir', { cwd, stdio: 'pipe', timeout: 3000 })
    isGit = true
  } catch {
    _cachedGitState = emptyGitState()
    return _cachedGitState!
  }

  if (!isGit) {
    _cachedGitState = emptyGitState()
    return _cachedGitState!
  }

  // Gather git info
  const state: GitState = {
    isGit: true,
    branch: '',
    mainBranch: '',
    status: '',
    recentCommits: '',
    userName: '',
    statusTruncated: false,
  }

  try {
    state.branch = execSync('git branch --show-current', { cwd, encoding: 'utf-8', timeout: 3000 }).trim()
  } catch { /* best-effort */ }

  try {
    // Try common main branch names
    for (const name of ['main', 'master']) {
      try {
        execSync(`git rev-parse --verify ${name}`, { cwd, stdio: 'pipe', timeout: 2000 })
        state.mainBranch = name
        break
      } catch { /* try next */ }
    }
  } catch { /* best-effort */ }

  try {
    const rawStatus = execSync('git status --short', { cwd, encoding: 'utf-8', timeout: 5000 })
    if (rawStatus.length > cfg.maxStatusChars) {
      state.status = rawStatus.substring(0, cfg.maxStatusChars) +
        `\n... (truncated, exceeds ${cfg.maxStatusChars} chars. Use BashTool for full status)`
      state.statusTruncated = true
    } else {
      state.status = rawStatus.trim()
    }
  } catch { /* best-effort */ }

  try {
    state.recentCommits = execSync(
      `git log --oneline -n ${cfg.recentCommitCount}`,
      { cwd, encoding: 'utf-8', timeout: 3000 },
    ).trim()
  } catch { /* best-effort */ }

  try {
    state.userName = execSync('git config user.name', { cwd, encoding: 'utf-8', timeout: 2000 }).trim()
  } catch { /* best-effort */ }

  _cachedGitState = state
  return state
}

/** Clear the git context cache (e.g., after `git checkout`). */
export function clearGitContextCache(): void {
  _cachedGitState = null
  _cachedCwd = ''
}

/**
 * Format git state as a system prompt injection string.
 * Mirrors the Claude Code git status output format.
 */
export function formatGitContext(state: GitState): string {
  if (!state.isGit) return ''

  const lines: string[] = [
    'This is the git status at the start of the conversation. Note that this status is a snapshot in time, and will not update during the conversation.',
  ]
  if (state.branch) lines.push(`Current branch: ${state.branch}`)
  if (state.mainBranch) lines.push(`Main branch (you will usually use this for PRs): ${state.mainBranch}`)
  if (state.userName) lines.push(`Git user: ${state.userName}`)
  if (state.recentCommits) {
    lines.push(`\nRecent commits:\n${state.recentCommits}`)
  }
  if (state.status) {
    lines.push(`\nGit status:\n${state.status}`)
  }

  return lines.join('\n')
}

// ── Helpers ──

function emptyGitState(): GitState {
  return {
    isGit: false,
    branch: '',
    mainBranch: '',
    status: '',
    recentCommits: '',
    userName: '',
    statusTruncated: false,
  }
}
