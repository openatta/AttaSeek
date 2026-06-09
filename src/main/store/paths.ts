/**
 * Shared data directory for plaintext storage.
 * All runtime data lives under ~/.atta/seek/.
 *
 * Uses os.homedir() with Electron-aware fallback so tests run
 * without the Electron runtime. Set ATTASEEK_DATA_DIR to override.
 */

import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'

let _dataDir: string | null = null

/** Returns the home directory, preferring Electron's app.getPath when available. */
function resolveHome(): string {
  if (process.env.ATTASEEK_DATA_DIR) return process.env.ATTASEEK_DATA_DIR
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron')
    return electron.app.getPath('home')
  } catch {
    return homedir()
  }
}

export function dataDir(): string {
  if (_dataDir) return _dataDir
  _dataDir = join(resolveHome(), '.atta', 'seek')
  return _dataDir
}

export function ensureDataDir(): void {
  if (!existsSync(dataDir())) mkdirSync(dataDir(), { recursive: true })
}
