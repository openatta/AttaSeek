/**
 * WorktreeManager — git worktree lifecycle for sub-agent isolation.
 *
 * Creates isolated git worktrees for sub-agents, supports merge/discard
 * on completion, and cleans up orphaned worktrees on startup.
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export class WorktreeManager {
  private activeWorktrees = new Map<string, string>() // agentId → worktree path

  /** Create a new worktree for a sub-agent (each agent gets its own branch) */
  create(agentId: string, baseBranch?: string): string {
    const branchName = `attaseek/${agentId}`
    const wtPath = path.join(os.tmpdir(), `attaseek-worktree-${agentId}`)

    try {
      execSync(`git worktree add -b "${branchName}" "${wtPath}" ${baseBranch || 'main'}`, { stdio: 'pipe', timeout: 10000 })
      this.activeWorktrees.set(agentId, wtPath)
      return wtPath
    } catch (err) {
      throw new Error(`Failed to create worktree: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  /** Merge worktree branch back to main branch */
  merge(agentId: string, message: string): boolean {
    const wtPath = this.activeWorktrees.get(agentId)
    if (!wtPath) return false
    const branchName = `attaseek/${agentId}`
    const sanitized = message.replace(/"/g, "'").replace(/`/g, "'")
    try {
      execSync(`git -C "${wtPath}" add . && git -C "${wtPath}" commit -m "${sanitized}"`, { stdio: 'pipe', timeout: 10000 })
      execSync(`git merge "${branchName}"`, { stdio: 'pipe', timeout: 10000 })
      this.discard(agentId)
      return true
    } catch {
      return false
    }
  }

  /** Discard worktree without merging */
  discard(agentId: string): void {
    const wtPath = this.activeWorktrees.get(agentId)
    if (!wtPath) return
    try {
      execSync(`git worktree remove --force "${wtPath}"`, { stdio: 'pipe', timeout: 10000 })
    } catch { /* force cleanup below */ }
    try {
      if (fs.existsSync(wtPath)) fs.rmSync(wtPath, { recursive: true, force: true })
    } catch { /* best effort */ }
    this.activeWorktrees.delete(agentId)
  }

  /** Clean orphaned worktrees on startup */
  cleanupOrphans(): void {
    try {
      execSync('git worktree prune', { stdio: 'pipe', timeout: 5000 })
    } catch { /* best effort */ }
    // Clean any leftover temp directories from previous runs
    const tmpDir = os.tmpdir()
    try {
      for (const entry of fs.readdirSync(tmpDir)) {
        if (entry.startsWith('attaseek-worktree-')) {
          const full = path.join(tmpDir, entry)
          if (fs.statSync(full).isDirectory()) {
            try { fs.rmSync(full, { recursive: true, force: true }) } catch { /* skip locked dirs */ }
          }
        }
      }
    } catch { /* best effort */ }
  }

  list(): string[] { return Array.from(this.activeWorktrees.keys()) }
}

export const worktreeManager = new WorktreeManager()
