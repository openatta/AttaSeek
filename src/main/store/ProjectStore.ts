/**
 * ProjectStore — manages project metadata as a single global JSON file.
 *
 * All projects are stored in ~/.atta/seek/projects.json as an array of
 * ProjectInfo objects. Sessions are stored separately by SessionStore
 * (referenced via SessionInfo.projectId), not per-directory.
 */

import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { dataDir } from './paths'
import { newId } from './id'
import type { ProjectInfo } from '../../shared/types/ipc'

function projectsPath(): string {
  return join(dataDir(), 'projects.json')
}

async function ensureDir(): Promise<void> {
  await mkdir(dataDir(), { recursive: true })
}

async function readProjects(): Promise<ProjectInfo[]> {
  try {
    const raw = await readFile(projectsPath(), 'utf-8')
    return JSON.parse(raw) as ProjectInfo[]
  } catch {
    return []
  }
}

async function writeProjects(projects: ProjectInfo[]): Promise<void> {
  await ensureDir()
  await writeFile(projectsPath(), JSON.stringify(projects, null, 2), 'utf-8')
}

export async function createProject(name: string, rootPath: string): Promise<ProjectInfo> {
  const projects = await readProjects()

  // Reject duplicate rootPath
  const existing = projects.find((p) => p.rootPath === rootPath)
  if (existing) {
    throw new Error(`目录已被项目 "${existing.name}" 使用`)
  }

  const project: ProjectInfo = { id: newId().slice(0, 12), name, rootPath, createdAt: Date.now() }
  projects.push(project)
  await writeProjects(projects)
  return project
}

export async function listProjects(): Promise<ProjectInfo[]> {
  return readProjects()
}

export async function getProject(id: string): Promise<ProjectInfo | null> {
  const projects = await readProjects()
  return projects.find((p) => p.id === id) || null
}

export async function removeProject(id: string): Promise<ProjectInfo | null> {
  const projects = await readProjects()
  const idx = projects.findIndex((p) => p.id === id)
  if (idx === -1) return null
  const [removed] = projects.splice(idx, 1)
  await writeProjects(projects)
  return removed
}

