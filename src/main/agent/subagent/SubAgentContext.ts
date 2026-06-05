/**
 * SubAgentContext — Context isolation and sharing for sub-agents.
 *
 * Sub-agents share project structure information but have isolated
 * conversation history. This prevents the sub-agent from being
 * influenced by the parent's reasoning chain.
 *
 * Inspired by Claude Code's forkSubagent isolation pattern.
 */

import type { MemoryEntry } from '../../../shared/types/Memory'
import type { AgentProfile } from '../profile/AgentProfile'

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export interface SubAgentContext {
  /** Snapshot of project file tree (read-only) */
  sharedFileTree: FileNode[]

  /** Project-level memories shared with sub-agent */
  sharedMemories: MemoryEntry[]

  /** Brief summary of the parent task for context */
  parentSummary: string

  /** Sub-agent profile overrides */
  profileOverrides?: Partial<AgentProfile>

  /** Isolation mode */
  isolation: 'inline' | 'worktree'
}

export function createSubAgentContext(
  parentSummary: string,
  sharedMemories: MemoryEntry[],
  isolation: 'inline' | 'worktree' = 'inline',
): SubAgentContext {
  return {
    sharedFileTree: [],
    sharedMemories: sharedMemories.filter(m => m.scope === 'project' || m.scope === 'global'),
    parentSummary,
    isolation,
  }
}
