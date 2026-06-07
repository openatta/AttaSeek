/**
 * SQLite database singleton — provides the database handle to all services.
 * Created once at app startup, initialized with schema from schema.ts.
 *
 * Runtime data stored at ~/.atta/seek/ (within the Atta monorepo config tree).
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { SCHEMA } from './schema'

let _dataDir: string | null = null
function dataDir(): string { if (!_dataDir) _dataDir = join(app.getPath('home'), '.atta', 'seek'); return _dataDir }

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db
  if (!existsSync(dataDir())) mkdirSync(dataDir(), { recursive: true })
  const dbPath = join(dataDir(), 'attaseek.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  // Safe migrations: add columns that may not exist in older DBs
  runMigrations(db)
  console.log(`[db] opened ${dbPath}`)
  return db
}

function runMigrations(db: Database.Database): void {
  // Add columns that may be missing from older schema versions
  const migrations: { table: string; col: string; def: string }[] = [
    // model_configs table removed — LLM config now in ~/.atta/settings.json
  ]
  for (const m of migrations) {
    const cols = dbQuery<{ name: string }>(`PRAGMA table_info(${m.table})`)
    if (!cols.some((c) => c.name === m.col)) {
      db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.col} ${m.def}`)
      console.log(`[db] migration: added ${m.table}.${m.col}`)
    }
  }
}

/** Typed query helper — eliminates `as any[]` boilerplate at call sites. */
export function dbQuery<T>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...params) as T[]
}

/** Typed single-row query helper. */
export function dbQueryOne<T>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined
}

export function closeDb(): void {
  if (db) { db.close(); db = null; console.log('[db] closed') }
}
