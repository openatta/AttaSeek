/**
 * WorktreeManager — git worktree lifecycle for sub-agent isolation.
 *
 * Creates isolated git worktrees for sub-agents, supports merge/discard
 * on completion, and cleans up orphaned worktrees on startup.
 */

import { exec as execAsync } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import { promises as fsp } from 'fs'
import * as path from 'path'
import * as os from 'os'

const exec = promisify(execAsync)

export class WorktreeManager {
  private activeWorktrees = new Map<string, string>() // agentId → worktree path

  /** Create a new worktree for a sub-agent (each agent gets its own branch) */
  async create(agentId: string, baseBranch?: string): Promise<string> {
    const branchName = `attaseek/${agentId}`
    const wtPath = path.join(os.tmpdir(), `attaseek-worktree-${agentId}`)

    try {
      await exec(`git worktree add -b "${branchName}" "${wtPath}" ${baseBranch || 'main'}`, { timeout: 10000 })
      this.activeWorktrees.set(agentId, wtPath)
      return wtPath
    } catch (err) {
      throw new Error(`Failed to create worktree: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  /** Merge worktree branch back to main branch */
  async merge(agentId: string, message: string): Promise<boolean> {
    const wtPath = this.activeWorktrees.get(agentId)
    if (!wtPath) return false
    const branchName = `attaseek/${agentId}`
    const sanitized = message.replace(/"/g, "'").replace(/`/g, "'")
    try {
      await exec(`git -C "${wtPath}" add . && git -C "${wtPath}" commit -m "${sanitized}"`, { timeout: 10000 })
      await exec(`git merge "${branchName}"`, { timeout: 10000 })
      await this.discard(agentId)
      return true
    } catch {
      return false
    }
  }

  /** Discard worktree without merging */
  async discard(agentId: string): Promise<void> {
    const wtPath = this.activeWorktrees.get(agentId)
    if (!wtPath) return
    try {
      await exec(`git worktree remove --force "${wtPath}"`, { timeout: 10000 })
    } catch { /* force cleanup below */ }
    try {
      await fsp.rm(wtPath, { recursive: true, force: true })
    } catch { /* best effort */ }
    this.activeWorktrees.delete(agentId)
  }

  /** Clean orphaned worktrees on startup */
  async cleanupOrphans(): Promise<void> {
    try {
      await exec('git worktree prune', { timeout: 5000 })
    } catch { /* best effort */ }
    // Clean any leftover temp directories from previous runs
    const tmpDir = os.tmpdir()
    try {
      const entries = await fsp.readdir(tmpDir)
      for (const entry of entries) {
        if (entry.startsWith('attaseek-worktree-')) {
          const full = path.join(tmpDir, entry)
          try {
            const stat = await fsp.stat(full)
            if (stat.isDirectory()) {
              try { await fsp.rm(full, { recursive: true, force: true }) } catch { /* skip locked dirs */ }
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* best effort */ }
  }

  list(): string[] { return Array.from(this.activeWorktrees.keys()) }
}

export const worktreeManager = new WorktreeManager()
