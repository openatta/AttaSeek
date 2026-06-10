/**
 * ProjectStore unit tests — CRUD operations with mocked filesystem.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock filesystem state
let mockFs: Record<string, string> = {}
let mockMkdirPaths: string[] = []

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
  return {
    default: { readFile, writeFile, mkdir },
    readFile,
    writeFile,
    mkdir,
  }
})

vi.mock('../../../src/main/store/paths', () => ({
  dataDir: () => '/mock/home/.atta/seek',
}))

vi.mock('../../../src/main/store/id', () => ({
  newId: () => 'base58uuid22charsX',
}))

import * as ProjectStore from '../../../src/main/store/ProjectStore'
import type { ProjectInfo } from '../../../src/shared/types/ipc'

describe('ProjectStore', () => {
  beforeEach(() => {
    mockFs = {}
    mockMkdirPaths = []
  })

  const makeProject = (): ProjectInfo => ({
    id: 'proj-001',
    name: 'TestApp',
    rootPath: '/tmp/test-app',
    createdAt: Date.now(),
  })

  // ── createProject ──

  it('creates a project and persists to projects.json', async () => {
    const p = await ProjectStore.createProject('TestApp', '/tmp/test-app')

    expect(p.name).toBe('TestApp')
    expect(p.rootPath).toBe('/tmp/test-app')
    expect(p.id).toBe('base58uuid22') // newId() mock returns 18 chars, sliced to 12
    expect(p.createdAt).toBeGreaterThan(0)

    // Verify persisted JSON
    const raw = mockFs['/mock/home/.atta/seek/projects.json']
    expect(raw).toBeDefined()
    const parsed = JSON.parse(raw!) as ProjectInfo[]
    expect(parsed).toHaveLength(1)
    expect(parsed[0].name).toBe('TestApp')
  })

  it('rejects duplicate rootPath', async () => {
    await ProjectStore.createProject('First', '/tmp/dup')
    await expect(
      ProjectStore.createProject('Second', '/tmp/dup'),
    ).rejects.toThrow('目录已被项目')
  })

  it('stores project name as provided (trimming is IPC handler responsibility)', async () => {
    // The IPC handler in project.ts trims the name before passing to store.
    // ProjectStore itself stores the name verbatim.
    const p = await ProjectStore.createProject('MyApp', '/tmp/myapp')
    expect(p.name).toBe('MyApp')
  })

  // ── listProjects ──

  it('lists all projects (empty initially)', async () => {
    const list = await ProjectStore.listProjects()
    expect(list).toEqual([])
  })

  it('lists projects after creation', async () => {
    await ProjectStore.createProject('A', '/tmp/a')
    await ProjectStore.createProject('B', '/tmp/b')
    const list = await ProjectStore.listProjects()
    expect(list).toHaveLength(2)
    expect(list.map((p) => p.name)).toEqual(['A', 'B'])
  })

  // ── getProject ──

  it('returns project by ID', async () => {
    const created = await ProjectStore.createProject('GetMe', '/tmp/getme')
    const found = await ProjectStore.getProject(created.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('GetMe')
  })

  it('returns null for non-existent ID', async () => {
    const found = await ProjectStore.getProject('nonexistent')
    expect(found).toBeNull()
  })

  // ── removeProject ──

  it('removes a project and returns it', async () => {
    const created = await ProjectStore.createProject('RemoveMe', '/tmp/rm')
    const removed = await ProjectStore.removeProject(created.id)

    expect(removed).not.toBeNull()
    expect(removed!.id).toBe(created.id)

    // Verify gone from list
    const list = await ProjectStore.listProjects()
    expect(list).toHaveLength(0)
  })

  it('returns null when removing non-existent project', async () => {
    const removed = await ProjectStore.removeProject('nope')
    expect(removed).toBeNull()
  })

  it('handles corrupted projects.json gracefully', async () => {
    mockFs['/mock/home/.atta/seek/projects.json'] = 'not valid json {{{'
    const list = await ProjectStore.listProjects()
    expect(list).toEqual([])
  })
})
