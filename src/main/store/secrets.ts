/**
 * secrets — encrypted API key storage via Electron safeStorage.
 *
 * macOS: Keychain
 * Windows: DPAPI
 * Linux: libsecret (falls back to plaintext if unavailable)
 *
 * API keys NEVER enter the renderer process.
 * Renderer can only query whether a key is configured, or set a key.
 */

import { safeStorage } from 'electron'
import { getDb } from './db'

const PREFIX = 'attaseek:provider:'

function storageKey(provider: string): string {
  return `${PREFIX}${provider}`
}

export interface StoreKeyResult {
  success: boolean
  encrypted: boolean
}

/** Store an API key for a provider (encrypted at OS level) */
export function storeApiKey(provider: string, key: string): StoreKeyResult {
  const db = getDb()
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[secrets] encryption not available — storing as plaintext (insecure)')
    db.prepare('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)')
      .run(storageKey(provider), key)
    return { success: true, encrypted: false }
  }
  const encrypted = safeStorage.encryptString(key)
  db.prepare('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)')
    .run(storageKey(provider), encrypted.toString('base64'))
  return { success: true, encrypted: true }
}

/** Retrieve an API key for a provider (decrypted) */
export function getApiKey(provider: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?')
    .get(storageKey(provider)) as { value: string } | undefined
  if (!row) return null
  if (!safeStorage.isEncryptionAvailable()) {
    return row.value
  }
  try {
    const buffer = Buffer.from(row.value, 'base64')
    return safeStorage.decryptString(buffer)
  } catch {
    console.error(`[secrets] failed to decrypt key for ${provider}`)
    return null
  }
}

/** Get masked preview of API key (last 4 chars) for display */
export function getApiKeyPreview(provider: string): { exists: boolean; preview: string } | null {
  const key = getApiKey(provider)
  if (!key) return { exists: false, preview: '' }
  const preview = key.length > 4 ? `...${key.slice(-4)}` : '****'
  return { exists: true, preview }
}

/** Delete an API key for a provider */
export function deleteApiKey(provider: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM app_state WHERE key = ?').run(storageKey(provider))
  return result.changes > 0
}

/** Check if OS-level encryption is available */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/** List providers that have stored keys */
export function listConfiguredProviders(): string[] {
  const db = getDb()
  const rows = db.prepare("SELECT key FROM app_state WHERE key LIKE ?")
    .all(`${PREFIX}%`) as { key: string }[]
  return rows.map((r) => r.key.replace(PREFIX, ''))
}
