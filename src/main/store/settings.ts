/**
 * Settings — plain-text JSON settings store.
 *
 * Path: ~/.atta/seek/settings.json
 * Project override: <project>/.atta/seek/settings.json
 *
 * Reads are mtime-cached; writes invalidate the cache.
 * Project settings overlay global settings on read.
 */

import { JSONStore } from './FileStore'
import { app } from 'electron'
import { join } from 'path'

let _dataDir: string | null = null
function dataDir(): string {
  if (!_dataDir) _dataDir = join(app.getPath('home'), '.atta', 'seek')
  return _dataDir
}
let _globalStore: JSONStore<Record<string, unknown>> | null = null
function globalStore(): JSONStore<Record<string, unknown>> {
  if (!_globalStore) _globalStore = new JSONStore<Record<string, unknown>>(join(dataDir(), 'settings.json'))
  return _globalStore
}

let projectStore: JSONStore<Record<string, unknown>> | null = null

const DEFAULTS: Record<string, unknown> = {
  theme: 'dark',
  importFromClaudeCode: true,
  importFromCodexDesktop: true,
  permissionMode: 'default',
  reasoningEffort: 'medium',
  modelConfigId: '',
}

export async function getSetting(key: string): Promise<unknown> {
  const global = await globalStore().read()
  const project = projectStore ? await projectStore.read() : {}
  return project[key] ?? global[key] ?? DEFAULTS[key]
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const store = projectStore || globalStore
  const data = await store.read()
  data[key] = value
  await store.write(data)
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const global = await globalStore().read()
  const project = projectStore ? await projectStore.read() : {}
  return { ...DEFAULTS, ...global, ...project }
}

export function setProjectRoot(root: string | null): void {
  if (root) {
    projectStore = new JSONStore<Record<string, unknown>>(join(root, '.atta', 'seek', 'settings.json'))
  } else {
    projectStore = null
  }
}

export function getProjectRoot(): string | null {
  return projectStore ? projectStore['filePath']?.split('/.atta/seek/')[0] || null : null
}
