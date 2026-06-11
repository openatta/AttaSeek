/**
 * SessionStore tests — mutex serialisation + data-layer CRUD with projectId filtering.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Data-layer mocks (hoisted by vitest) ──
let mockFs: Record<string, string> = {}
const mockMkdirPaths: string[] = []

vi.mock('fs/promises', async () => {
  const readFile = vi.fn(async (path: string) => {
    const content = mockFs[path as string]
    if (content === undefined) {
      const err = new Error('ENOENT: no such file')
      ;(err as any).code = 'ENOENT'
      throw err
    }
    return content
  })
  const writeFile = vi.fn(async (path: string, data: string) => {
    mockFs[path as string] = data
  })
  const mkdir = vi.fn(async (_path: string, _opts?: any) => {
    mockMkdirPaths.push(_path)
  })
  const unlink = vi.fn(async (path: string) => {
    delete mockFs[path as string]
  })
  return {
    default: { readFile, writeFile, mkdir, unlink },
    readFile, writeFile, mkdir, unlink,
  }
})

vi.mock('electron', () => ({
  app: { getPath: () => '/mock/home' },
}))

vi.mock('../../../src/main/store/paths', () => ({
  dataDir: () => '/mock/home/.atta/seek',
}))

vi.mock('../../../src/main/store/id', () => ({
  newId: () => 'base58uuid22charsX',
}))

// ── Imports (after all vi.mock calls) ──
import { withMutex, _resetMutex } from '../../../src/main/store/mutex'
import * as SessionStore from '../../../src/main/store/SessionStore'
import type { SessionInfo } from '../../../src/shared/types/AgentTask'

// ── Mutex tests (unchanged from original) ──

describe('SessionStore index mutex', () => {
  beforeEach(() => {
    _resetMutex()
  })

  it('serialises concurrent async operations', async () => {
    const order: number[] = []

    const ops = [
      withMutex(async () => {
        order.push(1)
        await new Promise(r => setTimeout(r, 10))
        return 1
      }),
      withMutex(async () => {
        order.push(2)
        await new Promise(r => setTimeout(r, 5))
        return 2
      }),
      withMutex(async () => {
        order.push(3)
        return 3
      }),
    ]

    const results = await Promise.all(ops)
    expect(results).toEqual([1, 2, 3])
    expect(order).toEqual([1, 2, 3])
  })

  it('releases the lock even when an operation throws', async () => {
    const order: number[] = []

    const ops = [
      withMutex(async () => { order.push(1); return 1 }),
      withMutex(async () => { order.push(2); throw new Error('op 2 failed') }),
      withMutex(async () => { order.push(3); return 3 }),
    ]

    const results = await Promise.allSettled(ops)
    const values = results.map(r =>
      r.status === 'fulfilled' ? (r as PromiseFulfilledResult<number>).value : null,
    )
    expect(order).toEqual([1, 2, 3])
    expect(values).toEqual([1, null, 3])
  })

  it('handles rapid concurrent access without deadlock', async () => {
    const N = 50
    const completed: number[] = []

    const ops = Array.from({ length: N }, (_, i) =>
      withMutex(async () => {
        completed.push(i)
        return i
      }),
    )

    const results = await Promise.all(ops)
    expect(results).toHaveLength(N)
    expect(completed).toEqual(Array.from({ length: N }, (_, i) => i))
  })

  it('simulates index read-modify-write that would lose updates without mutex', async () => {
    let index: number[] = []

    const addToIndex = (value: number) =>
      withMutex(async () => {
        const current = [...index]
        await new Promise(r => setTimeout(r, 2))
        current.push(value)
        index = current
        return value
      })

    const ops = Array.from({ length: 20 }, (_, i) => addToIndex(i))
    await Promise.all(ops)

    expect(index).toHaveLength(20)
    expect(index).toEqual(Array.from({ length: 20 }, (_, i) => i))
  })
})

// ── Data-layer tests (projectId filtering) ──

const INDEX_PATH = '/mock/home/.atta/seek/sessions/_index.json'
const META_PATH = (id: string) => `/mock/home/.atta/seek/sessions/${id}.json`

describe('SessionStore projectId filtering', () => {
  beforeEach(() => {
    mockFs = {}
    mockMkdirPaths.length = 0
    _resetMutex()
  })

  function makeIndex(sessions: SessionInfo[]): void {
    mockFs[INDEX_PATH] = JSON.stringify(sessions)
  }
  function makeMeta(session: SessionInfo): void {
    mockFs[META_PATH(session.id)] = JSON.stringify(session)
  }

  const chatSession: SessionInfo = {
    id: 's-chat-1', title: 'Chat Session', activity: 'chat',
    projectId: null, createdAt: 1000, updatedAt: 2000,
  }
  const projectSession: SessionInfo = {
    id: 's-proj-1', title: 'Project Session', activity: 'projects',
    projectId: 'proj-001', createdAt: 1000, updatedAt: 2000,
  }
  const projectSession2: SessionInfo = {
    id: 's-proj-2', title: 'Project B Session', activity: 'projects',
    projectId: 'proj-002', createdAt: 1500, updatedAt: 2500,
  }

  it('lists all sessions when no projectId filter', async () => {
    makeIndex([chatSession, projectSession, projectSession2])
    const list = await SessionStore.listSessions()
    expect(list).toHaveLength(3)
  })

  it('filters sessions by projectId (specific project)', async () => {
    makeIndex([chatSession, projectSession, projectSession2])
    const list = await SessionStore.listSessions(undefined, 'proj-001')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('s-proj-1')
  })

  it('filters CHATS sessions (projectId=null)', async () => {
    makeIndex([chatSession, projectSession])
    const list = await SessionStore.listSessions(undefined, null)
    expect(list).toHaveLength(1)
    expect(list[0].projectId).toBeNull()
  })

  it('filters by activity + projectId combined', async () => {
    makeIndex([chatSession, projectSession, projectSession2])
    const list = await SessionStore.listSessions('projects', 'proj-001')
    expect(list).toHaveLength(1)
    expect(list[0].activity).toBe('projects')
    expect(list[0].projectId).toBe('proj-001')
  })

  it('returns empty when no sessions match projectId', async () => {
    makeIndex([chatSession])
    const list = await SessionStore.listSessions(undefined, 'nonexistent')
    expect(list).toHaveLength(0)
  })

  it('creates session with projectId=null for CHATS', async () => {
    makeIndex([])
    const s = await SessionStore.createSession('s-new', 'Chat', 'chat', null)
    expect(s.projectId).toBeNull()
  })

  it('creates session with specific projectId', async () => {
    makeIndex([])
    const s = await SessionStore.createSession('s-new', 'Proj Chat', 'projects', 'proj-001')
    expect(s.projectId).toBe('proj-001')
  })

  it('deduplicates by id, preserving projectId', async () => {
    makeIndex([projectSession])
    makeMeta(projectSession)
    const s = await SessionStore.createSession(projectSession.id, 'Updated', 'projects', 'proj-001')
    expect(s.projectId).toBe('proj-001')
    const raw = mockFs[INDEX_PATH]
    expect(JSON.parse(raw!)).toHaveLength(1)
  })

  it('deleted session not returned by projectId filter', async () => {
    makeIndex([chatSession, projectSession])
    makeMeta(chatSession)
    makeMeta(projectSession)
    await SessionStore.deleteSession('s-proj-1')
    const list = await SessionStore.listSessions(undefined, 'proj-001')
    expect(list).toHaveLength(0)
  })

  it('handles corrupted _index.json gracefully', async () => {
    mockFs[INDEX_PATH] = 'not json {{{'
    const list = await SessionStore.listSessions()
    expect(list).toEqual([])
  })
})
