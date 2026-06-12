/**
 * AutoLauncher — cross-platform auto-start registration.
 *
 * macOS:   LaunchAgent plist at ~/Library/LaunchAgents/com.attago.attaseek.plist
 * Windows: Registry Run key HKCU\Software\Microsoft\Windows\CurrentVersion\Run
 * Linux:   XDG autostart .desktop at ~/.config/autostart/attaseek.desktop
 */

import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { execSync } from 'child_process'

const platform = process.platform
const APP_NAME = 'AttaSeek'

function exePath(): string {
  return process.execPath
}

// ── macOS LaunchAgent ──

function macPlistPath(): string {
  return join(homedir(), 'Library', 'LaunchAgents', 'com.attago.attaseek.plist')
}

function macEnable(): void {
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.attago.attaseek</string>
  <key>ProgramArguments</key>
  <array>
    <string>${exePath()}</string>
    <string>--auto-started</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>`
  const dir = join(homedir(), 'Library', 'LaunchAgents')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(macPlistPath(), plist, 'utf-8')
}

function macDisable(): void {
  try { unlinkSync(macPlistPath()) } catch { /* not present */ }
}

function macIsEnabled(): boolean {
  return existsSync(macPlistPath())
}

// ── Windows Registry ──

function winRegKey(): string {
  return 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
}

function winEnable(): void {
  execSync(`reg add "${winRegKey()}" /v ${APP_NAME} /t REG_SZ /d "${exePath()} --auto-started" /f`, { stdio: 'ignore' })
}

function winDisable(): void {
  try { execSync(`reg delete "${winRegKey()}" /v ${APP_NAME} /f`, { stdio: 'ignore' }) } catch { /* not present */ }
}

function winIsEnabled(): boolean {
  try {
    const out = execSync(`reg query "${winRegKey()}" /v ${APP_NAME}`, { stdio: 'pipe' }).toString()
    return out.includes(APP_NAME)
  } catch { return false }
}

// ── Linux autostart ──

function linuxDesktopPath(): string {
  return join(homedir(), '.config', 'autostart', 'attaseek.desktop')
}

function linuxEnable(): void {
  const desktop = `[Desktop Entry]
Type=Application
Name=${APP_NAME}
Exec=${exePath()} --auto-started
X-GNOME-Autostart-enabled=true
`
  const dir = join(homedir(), '.config', 'autostart')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(linuxDesktopPath(), desktop, 'utf-8')
}

function linuxDisable(): void {
  try { unlinkSync(linuxDesktopPath()) } catch { /* not present */ }
}

function linuxIsEnabled(): boolean {
  return existsSync(linuxDesktopPath())
}

// ── Public API ──

export const AutoLauncher = {
  async enable(): Promise<void> {
    if (platform === 'darwin') macEnable()
    else if (platform === 'win32') winEnable()
    else linuxEnable()
  },

  async disable(): Promise<void> {
    if (platform === 'darwin') macDisable()
    else if (platform === 'win32') winDisable()
    else linuxDisable()
  },

  async isEnabled(): Promise<boolean> {
    if (platform === 'darwin') return macIsEnabled()
    if (platform === 'win32') return winIsEnabled()
    return linuxIsEnabled()
  },

  /** Whether this process was started by the auto-launcher. */
  wasAutoStarted(): boolean {
    return process.argv.includes('--auto-started')
  },
}
