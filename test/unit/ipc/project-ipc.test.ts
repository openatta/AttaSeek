/**
 * Project IPC handler unit tests — all 4 channels tested in isolation.
 *
 * Captures ipcMain.handle() registrations and exercises each handler
 * with mocked ProjectStore, SessionStore, and AgentRuntime.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Hoisted mutable state (safe because vi.mock factories access via closure) ──
const state = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => Promise<any>>,
  mock: {
    createProject: vi.fn(),
    listProjects: vi.fn(),
    getProject: vi.fn(),
    removeProject: vi.fn(),
    listSessions: vi.fn(),
    deleteSession: vi.fn(),
    listBySession: vi.fn(),
    cancelTask: vi.fn(),
    closeSession: vi.fn(),
  },
  fsAccessOk: true,
  fsRmOk: true,
}))

vi.mock('electron', () => {
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (...a: any[]) => any) => {
      state.handlers[channel] = handler as any
    }),
  }
  return { ipcMain }
})

vi.mock('../../../src/main/store/ProjectStore', () => ({
  createProject: (...a: any[]) => state.mock.createProject(...a),
  listProjects: (...a: any[]) => state.mock.listProjects(...a),
  getProject: (...a: any[]) => state.mock.getProject(...a),
  removeProject: (...a: any[]) => state.mock.removeProject(...a),
}))

vi.mock('../../../src/main/store/SessionStore', () => ({
  listSessions: (...a: any[]) => state.mock.listSessions(...a),
  deleteSession: (...a: any[]) => state.mock.deleteSession(...a),
}))

vi.mock('../../../src/main/agent/AgentRuntime', () => ({
  agentRuntime: {
    listBySession: (...a: any[]) => state.mock.listBySession(...a),
    cancelTask: (...a: any[]) => state.mock.cancelTask(...a),
    closeSession: (...a: any[]) => state.mock.closeSession(...a),
  },
}))

vi.mock('fs/promises', async () => {
  const access = vi.fn(async () => {
    if (!state.fsAccessOk) {
      const err = new Error('EACCES'); (err as any).code = 'EACCES'; throw err
    }
  })
  const rm = vi.fn(async () => { if (!state.fsRmOk) throw new Error('rm failed') })
  const rmdir = vi.fn(async () => {})
  const stat = vi.fn(async () => ({ isDirectory: () => true }))
  return { default: { access, rm, rmdir, stat }, access, rm, rmdir, stat }
})

vi.mock('fs', () => {
  const constants = { R_OK: 4, W_OK: 2, F_OK: 0 }
  return { default: { constants }, constants }
})

import { registerProjectHandlers } from '../../../src/main/ipc/project'

describe('Project IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.fsAccessOk = true
    state.fsRmOk = true
    state.handlers = {}
    registerProjectHandlers()
  })

  const h = (channel: string) => state.handlers[channel]

  // ── project:create ──

  it('create — success path', async () => {
    state.mock.createProject.mockResolvedValue({
      id: 'proj-new', name: 'Test', rootPath: '/tmp/test', createdAt: 1234,
    })
    const r = await h('project:create')({}, { name: 'Test', rootPath: '/tmp/test' })
    expect(r.project).toBeDefined()
    expect(r.project.name).toBe('Test')
    expect(state.mock.createProject).toHaveBeenCalledWith('Test', '/tmp/test')
  })

  it('create — fails with empty name', async () => {
    const r = await h('project:create')({}, { name: '', rootPath: '/tmp/test' })
    expect(r.error).toContain('name')
  })

  it('create — fails with empty rootPath', async () => {
    const r = await h('project:create')({}, { name: 'Test', rootPath: '' })
    expect(r.error).toContain('rootPath')
  })

  it('create — fails when directory not accessible', async () => {
    state.fsAccessOk = false
    const r = await h('project:create')({}, { name: 'Test', rootPath: '/no-access' })
    expect(r.error).toBeDefined()
  })

  it('create — rejects duplicate rootPath', async () => {
    state.mock.createProject.mockRejectedValue(new Error('目录已被项目 "Existing" 使用'))
    const r = await h('project:create')({}, { name: 'Test', rootPath: '/tmp/dup' })
    expect(r.error).toContain('Existing')
  })

  // ── project:list ──

  it('list — returns projects', async () => {
    state.mock.listProjects.mockResolvedValue([{ id: 'p1', name: 'A', rootPath: '/a', createdAt: 1 }])
    const r = await h('project:list')()
    expect(r.projects).toHaveLength(1)
  })

  it('list — empty array', async () => {
    state.mock.listProjects.mockResolvedValue([])
    const r = await h('project:list')()
    expect(r.projects).toEqual([])
  })

  it('list — captures store error', async () => {
    state.mock.listProjects.mockRejectedValue(new Error('disk full'))
    const r = await h('project:list')()
    expect(r.error).toContain('disk full')
  })

  // ── project:remove ──

  it('remove — full cleanup with sessions', async () => {
    state.mock.getProject.mockResolvedValue({ id: 'proj-rm', name: 'X', rootPath: '/tmp/rm', createdAt: 1 })
    state.mock.listSessions.mockResolvedValue([
      { id: 's1', projectId: 'proj-rm' }, { id: 's2', projectId: 'proj-rm' },
    ])
    state.mock.listBySession.mockReturnValue([])
    state.mock.deleteSession.mockResolvedValue(true)
    state.mock.removeProject.mockResolvedValue({ id: 'proj-rm' } as any)

    const r = await h('project:remove')({}, { projectId: 'proj-rm' })
    expect(r.success).toBe(true)
    expect(r.deletedSessions).toBe(2)
  })

  it('remove — cancels active agent tasks', async () => {
    state.mock.getProject.mockResolvedValue({ id: 'proj-rm', name: 'X', rootPath: '/tmp/rm', createdAt: 1 })
    state.mock.listSessions.mockResolvedValue([{ id: 's1', projectId: 'proj-rm' }])
    state.mock.listBySession.mockReturnValue([{ id: 'task-1' }, { id: 'task-2' }])
    state.mock.cancelTask.mockReturnValue(true)
    state.mock.deleteSession.mockResolvedValue(true)
    state.mock.removeProject.mockResolvedValue({ id: 'proj-rm' } as any)

    const r = await h('project:remove')({}, { projectId: 'proj-rm' })
    expect(r.cancelledTasks).toBe(2)
    expect(state.mock.cancelTask).toHaveBeenCalledTimes(2)
  })

  it('remove — fails for non-existent project', async () => {
    state.mock.getProject.mockResolvedValue(null)
    const r = await h('project:remove')({}, { projectId: 'nope' })
    expect(r.error).toContain('不存在')
  })

  it('remove — continues cleanup despite session deletion errors', async () => {
    state.mock.getProject.mockResolvedValue({ id: 'proj-rm', name: 'X', rootPath: '/tmp/rm', createdAt: 1 })
    state.mock.listSessions.mockResolvedValue([
      { id: 's1', projectId: 'proj-rm' }, { id: 's2', projectId: 'proj-rm' },
    ])
    state.mock.listBySession.mockReturnValue([])
    state.mock.deleteSession.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('IO error'))
    state.mock.removeProject.mockResolvedValue({ id: 'proj-rm' } as any)

    const r = await h('project:remove')({}, { projectId: 'proj-rm' })
    expect(r.deletedSessions).toBe(1)
    expect(r.success).toBe(true)
  })

  // ── project:validate ──

  it('validate — returns valid=true for accessible path', async () => {
    state.fsAccessOk = true
    const r = await h('project:validate')({}, { rootPath: '/tmp/ok' })
    expect(r.valid).toBe(true)
  })

  it('validate — returns valid=false for inaccessible path', async () => {
    state.fsAccessOk = false
    const r = await h('project:validate')({}, { rootPath: '/no-access' })
    expect(r.valid).toBe(false)
  })

  it('validate — fails with empty rootPath', async () => {
    const r = await h('project:validate')({}, { rootPath: '' })
    expect(r.error).toContain('rootPath')
  })
})
