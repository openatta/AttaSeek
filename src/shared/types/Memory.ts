/**
 * Memory — two-layer memory system (L1 scratchpad + L2 persistent).
 * Managed by MemoryService in main process.
 */

export type MemoryLayer = 'L0' | 'L1' | 'L2'

export type MemoryType = 'user_preference' | 'project_memory' | 'enterprise_knowledge' | 'task_state'

export type MemoryScope = 'user' | 'project' | 'plugin' | 'global'

export interface MemoryEntry {
  id: string
  layer: MemoryLayer
  scope: MemoryScope
  scopeId: string
  type: MemoryType
  content: string
  source: string
  sessionId?: string
  taskId?: string
  createdAt: number
  updatedAt: number
}

export interface MemoryQuery {
  scope?: MemoryScope
  scopeId?: string
  projectId?: string       // convenience: maps to scope='project' + scopeId=projectId
  type?: MemoryType
  layer?: MemoryLayer
  query?: string
  limit?: number
}
