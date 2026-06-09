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
import type { LLMMessage } from '../llm/ModelProvider'

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

  /**
   * Parent conversation messages to inherit (forkWithContext).
   * Truncated to last N turns — provides the sub-agent with the parent's
   * reasoning chain without making context too large.
   */
  parentMessages?: LLMMessage[]

  /**
   * Parent's rendered system prompt to inherit (forkWithContext).
   * When provided, replaces the sub-agent's default system prompt with
   * a merged version.
   */
  parentSystemPrompt?: string
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

/**
 * Create a minimal parent task context from tool execution context.
 * Used by tool implementations (spawn_agent, send_message) that need
 * a parent task reference for SubAgentManager.fork().
 */
export function createParentTask(ctx?: { taskId?: string; sessionId?: string; projectId?: string }): {
  id: string; sessionId: string; projectId?: string; goal: string;
  status: 'idle'; createdAt: number; updatedAt: number;
} {
  return {
    id: ctx?.taskId || 'unknown',
    sessionId: ctx?.sessionId || 'default',
    projectId: ctx?.projectId,
    goal: 'parent task',
    status: 'idle',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
