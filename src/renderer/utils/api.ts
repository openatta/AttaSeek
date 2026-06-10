/**
 * Type-safe accessor for the Electron preload API exposed via contextBridge.
 *
 * Replaces the unsafe pattern:
 *   (window as unknown as Record<string, unknown>).api as { ... }
 *
 * Usage:
 *   import { getApi } from '../utils/api'
 *   const api = getApi()
 *   const result = await api.fs.readDir('/path')
 */

import type { AttaSeekAPI } from '../../preload/index'

let cached: AttaSeekAPI | null = null

/**
 * Returns the typed preload API from window.
 * Result is cached after first call.
 */
export function getApi(): AttaSeekAPI {
  if (cached) return cached
  cached = (window as unknown as { api: AttaSeekAPI }).api
  return cached
}
