/**
 * MemoryService tests — L1 scratchpad + L2 persistence with projectId filtering.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mock filesystem for L2 tests ──
let mockFsData: Record<string, string> = {}

vi.mock('fs/promises', async () => {
  const readFile = vi.fn(async (path: string) => {
    const content = mockFsData[path as string]
    if (content === undefined) {
      const err = new Error('ENOENT: no such file')
      ;(err as any).code = 'ENOENT'
      throw err
    }
    return content
  })
  const writeFile = vi.fn(async (path: string, data: string) => {
    mockFsData[path as string] = data
  })
  const mkdir = vi.fn(async () => {})
  return {
    default: { readFile, writeFile, mkdir },
    readFile, writeFile, mkdir,
  }
})

vi.mock('../../../src/main/store/paths', () => ({
  dataDir: () => '/mock/home/.atta/seek',
}))

import { MemoryService } from '../../../src/main/memory/MemoryService'
import type { MemoryEntry } from '../../../src/shared/types/Memory'

const MEMORIES_PATH = '/mock/home/.atta/seek/memories.jsonl'

describe('MemoryService', () => {
  let svc: MemoryService

  beforeEach(() => {
    mockFsData = {}
    svc = new MemoryService()
  })

  // ── L1: Scratchpad (in-memory, no mock needed) ──

  it('stores and recalls L1 scratchpad', () => {
    svc.setScratchpad('s1', 'k', 'v')
    expect(svc.getScratchpad('s1', 'k')).toBe('v')
  })

  it('returns undefined for missing scratchpad key', () => {
    expect(svc.getScratchpad('s1', 'nope')).toBeUndefined()
  })

  it('clears scratchpad for a session', () => {
    svc.setScratchpad('s1', 'k', 'v')
    svc.clearScratchpad('s1')
    expect(svc.getScratchpad('s1', 'k')).toBeUndefined()
  })

  // ── L2: Persistent recall with projectId filtering ──

  function seedMemories(entries: MemoryEntry[]): void {
    mockFsData[MEMORIES_PATH] = entries.map(e => JSON.stringify(e)).join('\n') + '\n'
  }

  const chUserPref: MemoryEntry = {
    id: 'mem-1', layer: 'L2', scope: 'user', scopeId: 'session-chat',
    type: 'user_preference', content: 'Always use dark theme',
    source: 'agent', sessionId: 'session-chat', createdAt: 1000, updatedAt: 1000,
  }

  const projMem: MemoryEntry = {
    id: 'mem-2', layer: 'L2', scope: 'project', scopeId: 'proj-001',
    type: 'project_memory', content: 'API port is 8080',
    source: 'agent', sessionId: 's-proj', createdAt: 2000, updatedAt: 2000,
  }

  const projMem2: MemoryEntry = {
    id: 'mem-3', layer: 'L2', scope: 'project', scopeId: 'proj-002',
    type: 'project_memory', content: 'Use Rust nightly',
    source: 'agent', sessionId: 's-proj2', createdAt: 3000, updatedAt: 3000,
  }

  it('recall with projectId returns only project-scoped memories for that project', async () => {
    seedMemories([chUserPref, projMem, projMem2])
    const results = await svc.recall({ projectId: 'proj-001', limit: 50 })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('mem-2')
    expect(results[0].content).toBe('API port is 8080')
  })

  it('recall with projectId excludes CHATS-scoped memories', async () => {
    seedMemories([chUserPref, projMem])
    const results = await svc.recall({ projectId: 'proj-001', limit: 50 })
    expect(results.every(r => r.scope === 'project')).toBe(true)
    expect(results.every(r => r.scopeId === 'proj-001')).toBe(true)
  })

  it('recall with explicit scope+scopeId matches same as projectId shorthand', async () => {
    seedMemories([chUserPref, projMem, projMem2])
    const byProjectId = await svc.recall({ projectId: 'proj-002', limit: 50 })
    const byScope = await svc.recall({ scope: 'project', scopeId: 'proj-002', limit: 50 })
    expect(byProjectId).toEqual(byScope)
  })

  it('recall projectId takes precedence over explicit scope when both set', async () => {
    seedMemories([projMem, projMem2])
    // Explicit scope='project'+scopeId='proj-002' but projectId='proj-001'
    const results = await svc.recall({ scope: 'project', scopeId: 'proj-002', projectId: 'proj-001', limit: 50 })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('mem-2')
  })

  it('recall without projectId returns all memories (no scope filter)', async () => {
    seedMemories([chUserPref, projMem])
    const results = await svc.recall({ limit: 50 })
    expect(results).toHaveLength(2)
  })

  it('recall returns empty array when no memories on disk', async () => {
    const results = await svc.recall({ projectId: 'proj-001', limit: 50 })
    expect(results).toEqual([])
  })

  it('recall sorts results by updatedAt descending', async () => {
    seedMemories([chUserPref, projMem]) // projMem has newer updatedAt
    const results = await svc.recall({ limit: 50 })
    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('mem-2') // newer first
  })
})
