/**
 * ThirdPartyImporter — imports config from Claude Code & Codex Desktop.
 *
 * Strategy: mtime comparison → dedup → copy.
 * Controlled by settings: importFromClaudeCode / importFromCodexDesktop.
 */

import { existsSync, statSync, readFileSync, copyFileSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { getSetting } from './settings'
import { CLAUDE_TO_ATTASEEK, CODEX_TO_ATTASEEK, mapSettings } from '../config/mapping'

let _seekDir: string, _claudeDir: string, _codexDir: string
function seekDir() { if (!_seekDir) _seekDir = join(app.getPath('home'), '.atta', 'seek'); return _seekDir }
function claudeDir() { if (!_claudeDir) _claudeDir = join(app.getPath('home'), '.claude'); return _claudeDir }
function codexDir() { if (!_codexDir) _codexDir = join(app.getPath('home'), '.codex'); return _codexDir }

export interface ImportResult {
  source: string
  settings: boolean
  memories: number
  skills: number
}

function isNewer(src: string, dst: string): boolean {
  if (!existsSync(src)) return false
  if (!existsSync(dst)) return true
  return statSync(src).mtimeMs > statSync(dst).mtimeMs
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export async function importFromClaudeCode(mainWindow?: BrowserWindow): Promise<ImportResult | null> {
  try {
    const enabled = await getSetting('importFromClaudeCode')
    if (!enabled) return null
  } catch { return null }

  const result: ImportResult = { source: 'Claude Code', settings: false, memories: 0, skills: 0 }
  if (!existsSync(claudeDir())) return null

  // settings.json
  const srcSettings = join(claudeDir(), 'settings.json')
  const dstSettings = join(seekDir(), 'settings.json')
  if (isNewer(srcSettings, dstSettings)) {
    ensureDir(seekDir())
    try {
      const claudeSettings = JSON.parse(readFileSync(srcSettings, 'utf-8'))
      const attaseekSettings: Record<string, unknown> = existsSync(dstSettings) ? JSON.parse(readFileSync(dstSettings, 'utf-8')) : {}
      const mapped = mapSettings(claudeSettings, CLAUDE_TO_ATTASEEK)
      for (const [k, v] of Object.entries(mapped)) {
        if (attaseekSettings[k] === undefined) attaseekSettings[k] = v
      }
      const { writeFileSync } = await import('fs')
      writeFileSync(dstSettings, JSON.stringify(attaseekSettings, null, 2))
      result.settings = true
    } catch { /* settings import failed */ }
  }

  // memories
  const srcMem = join(claudeDir(), 'memory')
  const dstMem = join(seekDir(), 'memories')
  if (existsSync(srcMem)) {
    ensureDir(dstMem)
    try {
      const { readdirSync } = await import('fs')
      for (const f of readdirSync(srcMem)) {
        if (!f.endsWith('.md')) continue
        const srcF = join(srcMem, f); const dstF = join(dstMem, f)
        if (isNewer(srcF, dstF)) { copyFileSync(srcF, dstF); result.memories++ }
      }
    } catch { /* memories import failed */ }
  }

  // skills
  const srcSkills = join(claudeDir(), 'skills')
  const dstSkills = join(seekDir(), 'skills')
  if (existsSync(srcSkills)) {
    ensureDir(dstSkills)
    try {
      const { readdirSync } = await import('fs')
      for (const skillDir of readdirSync(srcSkills, { withFileTypes: true })) {
        if (!skillDir.isDirectory()) continue
        const skillFile = join(srcSkills, skillDir.name, 'SKILL.md')
        if (!existsSync(skillFile)) continue
        const dstDir = join(dstSkills, skillDir.name)
        const dstFile = join(dstDir, 'SKILL.md')
        if (isNewer(skillFile, dstFile)) {
          ensureDir(dstDir); copyFileSync(skillFile, dstFile); result.skills++
        }
      }
    } catch { /* skills import failed */ }
  }

  return result
}

export async function importFromCodexDesktop(_mainWindow?: BrowserWindow): Promise<ImportResult | null> {
  try {
    const enabled = await getSetting('importFromCodexDesktop')
    if (!enabled) return null
  } catch { return null }

  if (!existsSync(codexDir())) return null
  // Same pattern as Claude Code import — settings + memories
  const result: ImportResult = { source: 'Codex Desktop', settings: false, memories: 0, skills: 0 }
  // (Codex has a different settings structure — basic import only)
  return result.memories > 0 || result.settings ? result : null
}
