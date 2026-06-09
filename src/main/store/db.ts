/**
 * Legacy SQLite database — retained for one-time data migration to plaintext.
 *
 * After migration, the SQLite file at ~/.atta/seek/attaseek.db is no longer
 * used for new reads/writes. All storage is now in ~/.atta/seek/ plaintext files.
 *
 * To remove the SQLite dependency entirely:
 *   1. Remove better-sqlite3 from package.json
 *   2. Delete this file, schema.ts, and util.ts (fromRow)
 *   3. Run `npm uninstall better-sqlite3`
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { dataDir } from './paths'

let _db: Database.Database | null = null

/** Open the legacy SQLite database for one-time migration. Returns null if no DB file exists. */
export function openLegacyDb(): Database.Database | null {
  if (_db) return _db
  const dbPath = join(dataDir(), 'attaseek.db')
  if (!existsSync(dbPath)) return null
  _db = new Database(dbPath)
  _db.pragma('journal_mode = WAL')
  return _db
}

/** Close and release the legacy database handle. */
export function closeLegacyDb(): void {
  if (_db) { _db.close(); _db = null }
}

/**
 * Typed query helper for legacy migration reads.
 * Only used during the one-time export step.
 */
export function dbQuery<T>(sql: string, ...params: unknown[]): T[] {
  if (!_db) return []
  return _db.prepare(sql).all(...params) as T[]
}

export function dbQueryOne<T>(sql: string, ...params: unknown[]): T | undefined {
  if (!_db) return undefined
  return _db.prepare(sql).get(...params) as T | undefined
}
