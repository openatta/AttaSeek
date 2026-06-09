/**
 * migrate-legacy — One-time export from legacy SQLite to plaintext files.
 *
 * Runs on first startup after upgrade. Detects the old attaseek.db file,
 * exports all data to new plaintext formats, then renames the DB file
 * to attaseek.db.legacy so it won't be opened again.
 *
 * Each export is idempotent: if the target plaintext file already exists
 * with data, that table's migration is skipped.
 */

import { existsSync, renameSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { openLegacyDb, closeLegacyDb, dbQuery, dbQueryOne } from './db'
import { dataDir, ensureDataDir } from './paths'

export interface MigrationResult {
  migrated: string[]
  skipped: string[]
  errors: string[]
}

/**
 * Run the legacy migration if a SQLite database file exists.
 * Call once at startup, before any services read plaintext files.
 */
export function migrateFromLegacyDb(): MigrationResult {
  const result: MigrationResult = { migrated: [], skipped: [], errors: [] }
  const db = openLegacyDb()
  if (!db) {
    result.skipped.push('all (no legacy DB found)')
    return result
  }

  ensureDataDir()
  const dir = dataDir()

  try {
    // ── permission_policies → permissions.json ──
    const permPath = join(dir, 'permissions.json')
    if (!existsSync(permPath)) {
      try {
        const rows = dbQuery<Record<string, unknown>>('SELECT * FROM permission_policies')
        const policies = rows.map(r => ({
          id: r.id, scope: r.scope, scopeId: r.scope_id,
          toolId: r.tool_id || undefined, pluginId: r.plugin_id || undefined,
          riskLevel: r.risk_level || undefined,
          decision: r.decision, createdAt: r.created_at, updatedAt: r.updated_at,
        }))
        writeFileSync(permPath, JSON.stringify({ policies }, null, 2), 'utf-8')
        result.migrated.push(`permission_policies (${policies.length} rows)`)
      } catch (err) {
        result.errors.push(`permission_policies: ${(err as Error).message}`)
      }
    } else {
      result.skipped.push('permission_policies (file exists)')
    }

    // ── audit_logs → audit.jsonl ──
    const auditPath = join(dir, 'audit.jsonl')
    if (!existsSync(auditPath)) {
      try {
        const rows = dbQuery<Record<string, unknown>>('SELECT * FROM audit_logs ORDER BY created_at')
        const lines = rows.map(r => JSON.stringify({
          id: r.id, taskId: r.task_id, sessionId: r.session_id, projectId: r.project_id,
          eventType: r.event_type, toolId: r.tool_id, riskLevel: r.risk_level,
          inputSummary: r.input_summary, outputSummary: r.output_summary,
          permissionResult: r.permission_result,
          artifactRefs: tryParse(r.artifact_refs), metadata: tryParse(r.metadata),
          createdAt: r.created_at,
        }))
        if (lines.length > 0) {
          writeFileSync(auditPath, lines.join('\n') + '\n', 'utf-8')
        }
        result.migrated.push(`audit_logs (${lines.length} rows)`)
      } catch (err) {
        result.errors.push(`audit_logs: ${(err as Error).message}`)
      }
    } else {
      result.skipped.push('audit_logs (file exists)')
    }

    // ── token_usage → token_usage.jsonl ──
    const tuPath = join(dir, 'token_usage.jsonl')
    if (!existsSync(tuPath)) {
      try {
        const rows = dbQuery<Record<string, unknown>>('SELECT * FROM token_usage ORDER BY created_at')
        const lines = rows.map(r => JSON.stringify({
          id: r.id, configId: r.config_id, sessionId: r.session_id, taskId: r.task_id,
          model: r.model, inputTokens: r.input_tokens, outputTokens: r.output_tokens,
          createdAt: r.created_at,
        }))
        if (lines.length > 0) {
          writeFileSync(tuPath, lines.join('\n') + '\n', 'utf-8')
        }
        result.migrated.push(`token_usage (${lines.length} rows)`)
      } catch (err) {
        result.errors.push(`token_usage: ${(err as Error).message}`)
      }
    } else {
      result.skipped.push('token_usage (file exists)')
    }

    // ── artifacts → artifacts/{id}.json ──
    const artifactsDir = join(dir, 'artifacts')
    if (!existsSync(artifactsDir)) {
      try {
        const { mkdirSync } = require('fs')
        mkdirSync(artifactsDir, { recursive: true })
        const rows = dbQuery<Record<string, unknown>>('SELECT * FROM artifacts')
        for (const r of rows) {
          const versions = dbQuery<Record<string, unknown>>(
            'SELECT version, content, created_at FROM artifact_versions WHERE artifact_id = ? ORDER BY version', r.id,
          )
          const artifact = {
            artifact: {
              id: r.id, sessionId: r.session_id, taskId: r.task_id,
              type: r.type, title: r.title, content: r.content,
              rendererHint: r.renderer_hint || undefined,
              version: r.version, editable: !!(r.editable as number | boolean),
              createdAt: r.created_at, updatedAt: r.updated_at,
            },
            versions: versions.map(v => ({
              version: v.version, content: v.content, createdAt: v.created_at,
            })),
          }
          writeFileSync(join(artifactsDir, `${r.id}.json`), JSON.stringify(artifact, null, 2), 'utf-8')
        }
        result.migrated.push(`artifacts (${rows.length} files)`)
      } catch (err) {
        result.errors.push(`artifacts: ${(err as Error).message}`)
      }
    } else {
      result.skipped.push('artifacts (dir exists)')
    }

    // ── memory_entries → memories.jsonl ──
    const memPath = join(dir, 'memories.jsonl')
    if (!existsSync(memPath)) {
      try {
        const rows = dbQuery<Record<string, unknown>>('SELECT * FROM memory_entries ORDER BY created_at')
        const lines = rows.map(r => JSON.stringify({
          id: r.id, layer: r.layer, scope: r.scope, scopeId: r.scope_id,
          type: r.type, content: r.content, source: r.source,
          sessionId: r.session_id, taskId: r.task_id,
          createdAt: r.created_at, updatedAt: r.updated_at,
        }))
        if (lines.length > 0) {
          writeFileSync(memPath, lines.join('\n') + '\n', 'utf-8')
        }
        result.migrated.push(`memory_entries (${lines.length} rows)`)
      } catch (err) {
        result.errors.push(`memory_entries: ${(err as Error).message}`)
      }
    } else {
      result.skipped.push('memory_entries (file exists)')
    }

    // ── agent_tasks → tasks/{id}.json ──
    const tasksDir = join(dir, 'tasks')
    if (!existsSync(tasksDir)) {
      try {
        const { mkdirSync } = require('fs')
        mkdirSync(tasksDir, { recursive: true })
        const rows = dbQuery<Record<string, unknown>>('SELECT * FROM agent_tasks')
        const ids: string[] = []
        for (const r of rows) {
          const task = {
            id: r.id, title: r.title, status: r.status,
            sessionId: r.session_id, goal: r.goal, output: r.output || undefined,
            createdAt: r.created_at, updatedAt: r.updated_at,
          }
          writeFileSync(join(tasksDir, `${r.id}.json`), JSON.stringify(task, null, 2), 'utf-8')
          ids.push(r.id as string)
        }
        writeFileSync(join(tasksDir, '_index.json'), JSON.stringify(ids), 'utf-8')
        result.migrated.push(`agent_tasks (${rows.length} files)`)
      } catch (err) {
        result.errors.push(`agent_tasks: ${(err as Error).message}`)
      }
    } else {
      result.skipped.push('agent_tasks (dir exists)')
    }

    // ── app_state → app_state.json ──
    const appPath = join(dir, 'app_state.json')
    if (!existsSync(appPath)) {
      try {
        const rows = dbQuery<Record<string, unknown>>('SELECT * FROM app_state')
        const state: Record<string, string> = {}
        for (const r of rows) {
          state[r.key as string] = r.value as string
        }
        writeFileSync(appPath, JSON.stringify(state, null, 2), 'utf-8')
        result.migrated.push(`app_state (${rows.length} keys)`)
      } catch (err) {
        result.errors.push(`app_state: ${(err as Error).message}`)
      }
    } else {
      result.skipped.push('app_state (file exists)')
    }

    // ── sessions → already handled by SessionStore (no migration needed) ──
    result.skipped.push('sessions (handled by SessionStore)')

    // Rename legacy DB file to prevent re-opening
    try {
      const dbPath = join(dir, 'attaseek.db')
      const legacyPath = join(dir, 'attaseek.db.legacy')
      if (existsSync(dbPath) && !existsSync(legacyPath)) {
        renameSync(dbPath, legacyPath)
        console.log('[migrate] renamed attaseek.db → attaseek.db.legacy')
      }
    } catch (err) {
      result.errors.push(`rename: ${(err as Error).message}`)
    }
  } finally {
    closeLegacyDb()
  }

  return result
}

function tryParse(val: unknown): unknown {
  if (typeof val === 'string') {
    try { return JSON.parse(val) } catch { return val }
  }
  return val
}
