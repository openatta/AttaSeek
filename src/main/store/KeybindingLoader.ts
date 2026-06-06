/**
 * KeybindingLoader — loads keybindings.json in VS Code format.
 *
 * Format: [{ key: "cmd+enter", command: "composer.send", when: "composerFocused" }]
 */

import { join } from 'path'
import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { getSetting } from '../config/ConfigManager'
import { DEFAULTS } from '../config/defaults'

export interface Keybinding { key: string; command: string; when?: string }

let _dataDir: string | null = null
function dataDir(): string { if (!_dataDir) _dataDir = join(app.getPath('home'), '.atta', 'seek'); return _dataDir }

const DEFAULT_BINDINGS: Keybinding[] = [
  { key: 'cmd+enter', command: 'composer.send', when: 'composerFocused' },
  { key: 'escape', command: 'composer.clear', when: 'composerFocused' },
  { key: 'cmd+k', command: 'composer.clear', when: 'composerFocused' },
]

export function loadKeybindings(): Keybinding[] {
  const customPath = DEFAULTS.keybindingsPath || join(dataDir(), 'keybindings.json')
  try {
    if (existsSync(customPath)) {
      const raw = readFileSync(customPath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter(k => k.key && k.command)
    }
  } catch { /* fall through to defaults */ }
  return DEFAULT_BINDINGS
}

export function saveKeybindings(bindings: Keybinding[]): void {
  const customPath = DEFAULTS.keybindingsPath || join(dataDir(), 'keybindings.json')
  const { writeFileSync, existsSync, mkdirSync } = require('fs')
  const { dirname } = require('path')
  const dir = dirname(customPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(customPath, JSON.stringify(bindings, null, 2))
}

export function resolveBinding(key: string): Keybinding | undefined {
  return loadKeybindings().find(k => k.key === key)
}
