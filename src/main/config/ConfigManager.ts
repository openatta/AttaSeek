/**
 * ConfigManager — unified configuration entry point.
 * Reads settings.json, merges with project overrides, validates, persists.
 */

import { JSONStore } from '../store/FileStore'
import { DEFAULTS } from './defaults'
import type { AttaSeekSettings } from './types'
import { app } from 'electron'
import { join } from 'path'

let _dataDir: string | null = null
function dataDir(): string { if (!_dataDir) _dataDir = join(app.getPath('home'), '.atta', 'seek'); return _dataDir }

let globalStore: JSONStore<AttaSeekSettings> | null = null
let projectStore: JSONStore<AttaSeekSettings> | null = null
let cache: AttaSeekSettings | null = null

function getGlobalStore(): JSONStore<AttaSeekSettings> {
  if (!globalStore) globalStore = new JSONStore<AttaSeekSettings>(join(dataDir(), 'settings.json'))
  return globalStore
}

export async function loadSettings(): Promise<AttaSeekSettings> {
  const global = await getGlobalStore().read()
  const project = projectStore ? await projectStore.read() : ({} as AttaSeekSettings)
  cache = deepMerge(DEFAULTS, global as AttaSeekSettings, project as AttaSeekSettings) as AttaSeekSettings
  return cache
}

export async function getSetting<K extends keyof AttaSeekSettings>(key: K): Promise<AttaSeekSettings[K]> {
  if (!cache) await loadSettings()
  return cache![key] ?? DEFAULTS[key]
}

export async function setSetting<K extends keyof AttaSeekSettings>(key: K, value: AttaSeekSettings[K]): Promise<void> {
  const store = projectStore || getGlobalStore()
  const data = await store.read()
  ;(data as Record<string, unknown>)[key as string] = value
  await store.write(data as AttaSeekSettings)
  if (cache) (cache as Record<string, unknown>)[key as string] = value
}

export async function getAllSettings(): Promise<AttaSeekSettings> {
  if (!cache) await loadSettings()
  return cache!
}

export function setProjectRoot(root: string | null): void {
  if (root) {
    projectStore = new JSONStore<AttaSeekSettings>(join(root, '.atta', 'seek', 'settings.json'))
  } else {
    projectStore = null
    cache = null
  }
}

function deepMerge(...sources: Partial<AttaSeekSettings>[]): AttaSeekSettings {
  const result: Record<string, unknown> = {}
  for (const src of sources) {
    for (const [key, val] of Object.entries(src)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && typeof result[key] === 'object') {
        result[key] = { ...result[key] as object, ...val as object }
      } else if (val !== undefined) {
        result[key] = val
      }
    }
  }
  return result as AttaSeekSettings
}
