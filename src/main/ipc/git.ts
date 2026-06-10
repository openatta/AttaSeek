/**
 * IPC handlers for git:* channels.
 *
 * Uses git CLI via child_process.execFile — same approach as VS Code.
 * All git operations are scoped to the provided repoPath.
 */

import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { ipcWrapAsync, validateRequiredString } from '../store/util'
import type { GitFileStatus, GitDiffFile, GitHunk, GitCommit } from '../../shared/types/ipc'

const execFileAsync = promisify(execFile)

let gitAvailable: boolean | null = null

/** Check if git is installed and accessible */
async function ensureGit(): Promise<void> {
  if (gitAvailable === null) {
    try {
      await execFileAsync('git', ['--version'], { timeout: 5000 })
      gitAvailable = true
    } catch {
      gitAvailable = false
    }
  }
  if (!gitAvailable) {
    throw new Error('Git is not installed or not accessible. Install git to use version control features.')
  }
}

function parsePorcelainStatus(output: string): GitFileStatus[] {
  const files: GitFileStatus[] = []
  for (const line of output.split('\n')) {
    if (!line.trim()) continue
    const staged = line[0] !== ' ' && line[0] !== '?'
    const worktree = line[1]
    const filePath = line.slice(3).trim()
    if (!filePath) continue

    const statusCode = staged ? line[0] : worktree
    let status: GitFileStatus['status'] = 'modified'
    if (statusCode === 'A') status = 'added'
    else if (statusCode === 'D') status = 'deleted'
    else if (statusCode === 'R') status = 'renamed'
    else if (statusCode === '?') status = 'untracked'

    files.push({ path: filePath, status, staged, additions: 0, deletions: 0 })
  }
  return files
}

async function gitExec(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 })
  return stdout
}

export function registerGitHandlers(): void {
  // git:status → list changed files with branch info
  ipcMain.handle('git:status', async (_e, p: { repoPath: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'repoPath', 'repoPath')
      await ensureGit()
      const branch = (await gitExec(p.repoPath, ['branch', '--show-current'])).trim()
      const statusOut = await gitExec(p.repoPath, ['status', '--porcelain'])
      const changedFiles = parsePorcelainStatus(statusOut)
      return { branch, changedFiles }
    })
  })

  // git:branches → list local branches
  ipcMain.handle('git:branches', async (_e, p: { repoPath: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'repoPath', 'repoPath')
      await ensureGit()
      const out = await gitExec(p.repoPath, ['branch', '--format=%(refname:short)'])
      const branches = out.split('\n').filter(Boolean)
      const currentOut = await gitExec(p.repoPath, ['branch', '--show-current'])
      return { branches, current: currentOut.trim() }
    })
  })

  // git:diff → get diff for specified scope
  ipcMain.handle('git:diff', async (_e, p: {
    repoPath: string
    scope?: 'uncommitted' | 'branch' | 'lastTurn'
    staged?: boolean
  }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'repoPath', 'repoPath')
      await ensureGit()
      const scope = p.scope || 'uncommitted'
      const staged = p.staged ?? false

      let diffArgs: string[]
      if (scope === 'branch') {
        // Diff against the tracked upstream or default branch
        let baseBranch = 'origin/main'
        try {
          const upstream = (await gitExec(p.repoPath, ['rev-parse', '--abbrev-ref', '@{upstream}'])).trim()
          if (upstream) baseBranch = upstream
        } catch { /* fall back to origin/main */ }
        diffArgs = ['diff', '--unified=3', `${baseBranch}...HEAD`]
      } else if (scope === 'lastTurn') {
        // Diff against HEAD (shows changes since last commit)
        diffArgs = staged ? ['diff', '--cached', '--unified=3', 'HEAD~1'] : ['diff', '--unified=3', 'HEAD~1']
      } else {
        // Uncommitted changes
        diffArgs = staged ? ['diff', '--cached', '--unified=3'] : ['diff', '--unified=3']
      }

      const diffOut = await gitExec(p.repoPath, diffArgs)
      const files: GitDiffFile[] = []

      // Parse unified diff into per-file sections
      const fileSections = diffOut.split(/(?=^diff --git )/m).filter(Boolean)
      for (const section of fileSections) {
        const headerMatch = section.match(/^diff --git a\/(.+) b\/(.+)$/m)
        if (!headerMatch) continue

        const filePath = headerMatch[2]
        const hunks: GitHunk[] = []
        let oldContent = ''
        let newContent = ''
        let additions = 0
        let deletions = 0

        const lines = section.split('\n')
        let currentHunk: string[] = []
        let hunkHeader = ''

        for (const line of lines) {
          if (line.startsWith('@@')) {
            if (hunkHeader) {
              hunks.push({ header: hunkHeader, lines: currentHunk })
            }
            hunkHeader = line
            currentHunk = []
          } else if (hunkHeader) {
            currentHunk.push(line)
            if (line.startsWith('+') && !line.startsWith('+++')) { additions++; newContent += line.slice(1) + '\n' }
            else if (line.startsWith('-') && !line.startsWith('---')) { deletions++; oldContent += line.slice(1) + '\n' }
            else if (!line.startsWith('diff') && !line.startsWith('index') && !line.startsWith('---') && !line.startsWith('+++')) {
              oldContent += line.slice(1) + '\n'; newContent += line.slice(1) + '\n'
            }
          }
        }
        if (hunkHeader) {
          hunks.push({ header: hunkHeader, lines: currentHunk })
        }

        files.push({ path: filePath, status: 'modified', additions, deletions, hunks, oldContent, newContent })
      }

      return { files }
    })
  })

  // git:stage → stage files
  ipcMain.handle('git:stage', async (_e, p: { repoPath: string; files?: string[] }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'repoPath', 'repoPath')
      await ensureGit()
      const args = ['add']
      if (p.files && p.files.length > 0) args.push(...p.files)
      else args.push('.')
      await gitExec(p.repoPath, args)
      return { success: true }
    })
  })

  // git:unstage → unstage files
  ipcMain.handle('git:unstage', async (_e, p: { repoPath: string; files?: string[] }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'repoPath', 'repoPath')
      await ensureGit()
      const args = ['reset', 'HEAD']
      if (p.files && p.files.length > 0) args.push(...p.files)
      await gitExec(p.repoPath, args)
      return { success: true }
    })
  })

  // git:revert → revert file changes
  ipcMain.handle('git:revert', async (_e, p: { repoPath: string; files?: string[] }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'repoPath', 'repoPath')
      await ensureGit()
      const args = ['checkout', '--']
      if (p.files && p.files.length > 0) args.push(...p.files)
      else args.push('.')
      await gitExec(p.repoPath, args)
      return { success: true }
    })
  })

  // git:commit → commit staged changes
  ipcMain.handle('git:commit', async (_e, p: { repoPath: string; message: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'repoPath', 'repoPath')
      validateRequiredString(p, 'message', 'message')
      await ensureGit()
      await gitExec(p.repoPath, ['commit', '-m', p.message])
      const hash = (await gitExec(p.repoPath, ['rev-parse', 'HEAD'])).trim()
      return { success: true, commitHash: hash }
    })
  })

  // git:log → commit history
  ipcMain.handle('git:log', async (_e, p: { repoPath: string; maxCount?: number }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'repoPath', 'repoPath')
      await ensureGit()
      const maxCount = p.maxCount || 20
      const out = await gitExec(p.repoPath, [
        'log', `-${maxCount}`, '--format=%H%x00%h%x00%s%x00%an%x00%at',
      ])
      const commits: GitCommit[] = out.split('\n').filter(Boolean).map((line) => {
        const [hash, shortHash, message, author, dateStr] = line.split('\x00')
        return { hash, shortHash, message, author, date: parseInt(dateStr, 10) * 1000 }
      })
      return { commits }
    })
  })

  // git:show → show a specific commit's diff
  ipcMain.handle('git:show', async (_e, p: { repoPath: string; ref: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'repoPath', 'repoPath')
      validateRequiredString(p, 'ref', 'ref')
      await ensureGit()
      const diff = await gitExec(p.repoPath, ['show', '--unified=3', p.ref])
      return { diff }
    })
  })

  console.log('[IPC:git] handlers registered')
}
