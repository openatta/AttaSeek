/**
 * TaskStore — plaintext JSON file storage for agent task management tools.
 * Each task stored as ~/.atta/seek/tasks/{id}.json. Index kept in _index.json.
 *
 * Replaces the SQLite-backed TaskStore with plaintext files.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { dataDir, ensureDataDir } from './paths'
import { withMutex } from './mutex'

export interface StoredTask {
  id: string
  title: string
  status: string
  sessionId: string
  goal: string
  output?: string
  createdAt: number
  updatedAt: number
}

function tasksDir(): string { return join(dataDir(), 'tasks') }
function taskPath(id: string): string { return join(tasksDir(), `${id}.json`) }
function indexPath(): string { return join(tasksDir(), '_index.json') }

function readIndex(): string[] {
  try { return JSON.parse(readFileSync(indexPath(), 'utf-8')) as string[] }
  catch { return [] }
}

function writeIndex(ids: string[]): void {
  const dir = tasksDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(indexPath(), JSON.stringify(ids), 'utf-8')
}

function readTask(id: string): StoredTask | null {
  try { return JSON.parse(readFileSync(taskPath(id), 'utf-8')) as StoredTask }
  catch { return null }
}

function writeTask(task: StoredTask): void {
  const fp = taskPath(task.id)
  const dir = dirname(fp)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(fp, JSON.stringify(task, null, 2), 'utf-8')
}

export const TaskStore = {
  create(params: { subject?: string; title?: string; description?: string; goal?: string; sessionId?: string }): StoredTask {
    ensureDataDir()
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const title = params.subject || params.title || ''
    const goal = params.description || params.goal || ''
    const sessionId = params.sessionId || ''
    const now = Date.now()

    const task: StoredTask = { id, title, status: 'pending', sessionId, goal, createdAt: now, updatedAt: now }
    writeTask(task)

    // Update index
    const ids = readIndex()
    ids.unshift(id)
    writeIndex(ids)

    return task
  },

  update(taskId: string, patch: { status?: string; title?: string; output?: string }): StoredTask | null {
    const existing = readTask(taskId)
    if (!existing) return null

    const now = Date.now()
    if (patch.status !== undefined) existing.status = patch.status
    if (patch.title !== undefined) existing.title = patch.title
    if (patch.output !== undefined) existing.output = patch.output
    existing.updatedAt = now

    writeTask(existing)
    return existing
  },

  get(taskId: string): StoredTask | null {
    return readTask(taskId)
  },

  list(sessionId?: string): StoredTask[] {
    ensureDataDir()
    const ids = readIndex()
    const tasks: StoredTask[] = []
    for (const id of ids) {
      const task = readTask(id)
      if (task) {
        if (!sessionId || task.sessionId === sessionId) {
          tasks.push(task)
        }
      }
    }
    return tasks.sort((a, b) => b.createdAt - a.createdAt)
  },

  delete(taskId: string): boolean {
    // Remove from index
    const ids = readIndex().filter(id => id !== taskId)
    writeIndex(ids)

    // Remove file
    try { unlinkSync(taskPath(taskId)); return true }
    catch { return false }
  },

  clear(): void {
    ensureDataDir()
    const ids = readIndex()
    for (const id of ids) {
      try { unlinkSync(taskPath(id)) } catch { /* ignore */ }
    }
    writeIndex([])
  },
}
