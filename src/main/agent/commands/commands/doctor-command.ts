/**
 * /doctor command — self-check the AttaSeek environment.
 *
 * Usage:
 *   /doctor → run diagnostics and report results
 *
 * Checks: Node version, Electron version, platform, git availability,
 * disk space at data dir, settings file readability.
 */

import { app } from 'electron'
import { existsSync } from 'fs'
import { execSync } from 'child_process'
import { homedir, totalmem, freemem, cpus } from 'os'
import type { SlashCommand } from '../CommandRegistry'

function checkGit(): string {
  try {
    const v = execSync('git --version', { stdio: 'pipe', timeout: 3000 }).toString().trim()
    return v
  } catch {
    return '❌ Not found'
  }
}

function checkDiskSpace(): string {
  try {
    const dataDir = app.getPath('userData')
    // Quick existence check — actual free space requires platform-specific calls
    if (existsSync(dataDir)) {
      return `✅ Data dir exists: \`${dataDir}\``
    }
    return `⚠️ Data dir not found: \`${dataDir}\``
  } catch {
    return '⚠️ Could not check data dir'
  }
}

function checkSettings(): string {
  try {
    const settingsPath = `${app.getPath('home')}/.atta/seek/settings.json`
    if (existsSync(settingsPath)) return `✅ Found: \`${settingsPath}\``
    return `⚠️ Not found (defaults used): \`${settingsPath}\``
  } catch {
    return '⚠️ Could not check settings'
  }
}

export const doctorCommand: SlashCommand = {
  name: 'doctor',
  description: 'Run self-diagnostics on the AttaSeek environment',

  execute() {
    const memTotal = (totalmem() / 1024 / 1024 / 1024).toFixed(1)
    const memFree = (freemem() / 1024 / 1024 / 1024).toFixed(1)
    const cpuModel = cpus()[0]?.model || 'Unknown'

    const lines = [
      '**AttaSeek Environment Diagnostics**',
      '',
      '| Check | Result |',
      '|-------|--------|',
      `| Platform | \`${process.platform}\` (${process.arch}) |`,
      `| Node.js | ${process.version} |`,
      `| Electron | ${process.versions.electron || 'unknown'} |`,
      `| CPU | ${cpuModel} (${cpus().length} cores) |`,
      `| Memory | ${memTotal} GB total, ${memFree} GB free |`,
      `| Home | \`${homedir()}\` |`,
      `| Git | ${checkGit()} |`,
      `| Settings | ${checkSettings()} |`,
      `| Data Dir | ${checkDiskSpace()} |`,
      '',
      'Use `/help` to see available commands.',
    ]

    return { messages: [], shouldQuery: false, resultText: lines.join('\n') }
  },
}
