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
    { table: 'model_configs', col: 'models', def: "TEXT NOT NULL DEFAULT '[]'" },
  ]
  for (const m of migrations) {
    const cols = db.prepare(`PRAGMA table_info(${m.table})`).all() as any[]
    if (!cols.some((c: any) => c.name === m.col)) {
      db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.col} ${m.def}`)
      console.log(`[db] migration: added ${m.table}.${m.col}`)
    }
  }
}

export function closeDb(): void {
  if (db) { db.close(); db = null; console.log('[db] closed') }
}
