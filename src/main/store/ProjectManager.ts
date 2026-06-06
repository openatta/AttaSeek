/**
 * ProjectManager — project .atta/seek/ lifecycle.
 *
 * Creates the project data directory on open, loads project CLAUDE.md,
 * registers to recent projects list at ~/.atta/seek/projects.json.
 */

import { join } from 'path'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { app } from 'electron'
import { JSONStore } from './FileStore'
import { setProjectRoot } from './settings'

let _dataDir: string | null = null
function dataDir(): string { if (!_dataDir) _dataDir = join(app.getPath('home'), '.atta', 'seek'); return _dataDir }
let _projectsStore: JSONStore<{ recent: { path: string; name: string; openedAt: number }[] }> | null = null
function projectsStore() { if (!_projectsStore) _projectsStore = new JSONStore(join(dataDir(), 'projects.json')); return _projectsStore }

export interface ProjectInfo {
  path: string
  name: string
  claudeMd?: string
  openedAt: number
}

export async function openProject(rootPath: string): Promise<ProjectInfo> {
  // Create .atta/seek/ structure if not exists
  const seekDir = join(rootPath, '.atta', 'seek')
  for (const sub of ['', 'memories', 'skills', 'sessions']) {
    const d = join(seekDir, sub)
    if (!existsSync(d)) mkdirSync(d, { recursive: true })
  }

  // Set project root for settings overlay
  setProjectRoot(rootPath)

  // Load CLAUDE.md
  let claudeMd: string | undefined
  const claudePath = join(seekDir, 'CLAUDE.md')
  if (existsSync(claudePath)) {
    claudeMd = readFileSync(claudePath, 'utf-8')
  } else {
    // Also check root CLAUDE.md
    const rootClaude = join(rootPath, 'CLAUDE.md')
    if (existsSync(rootClaude)) {
      claudeMd = readFileSync(rootClaude, 'utf-8')
    }
  }

  const info: ProjectInfo = {
    path: rootPath,
    name: rootPath.split('/').pop() || rootPath,
    claudeMd,
    openedAt: Date.now(),
  }

  // Register to recent projects
  const data = await projectsStore().read()
  const recent = data.recent || []
  const existing = recent.findIndex(r => r.path === rootPath)
  if (existing >= 0) recent.splice(existing, 1)
  recent.unshift({ path: rootPath, name: info.name, openedAt: info.openedAt })
  if (recent.length > 20) recent.length = 20
  await projectsStore().write({ recent })

  return info
}

export async function closeProject(): Promise<void> {
  setProjectRoot(null)
}

export async function listRecentProjects(): Promise<ProjectInfo[]> {
  const data = await projectsStore().read()
  return (data.recent || []).map(r => ({ ...r, claudeMd: undefined }))
}
