/**
 * UpdateInstaller — platform-specific update application.
 *
 * macOS:   hdiutil attach → cp -R .app → hdiutil detach → relaunch
 * Windows: spawn NSIS installer with /S (silent) → relaunch
 * Linux:   cp AppImage to install path → chmod +x → relaunch
 *
 * Before installing, backs up the current version to ~/.atta/seek/versions/v{old}/
 * for crash-loop rollback recovery.
 */

import { spawn, execFile } from 'child_process'
import { platform as osPlatform } from 'os'
import { copyFile, mkdir, rename } from 'fs/promises'
import { existsSync } from 'fs'
import { join, basename } from 'path'
import { app } from 'electron'
import { dataDir } from '../store/paths'

const isMac = osPlatform() === 'darwin'
const isWindows = osPlatform() === 'win32'
const isLinux = osPlatform() === 'linux'

/** Resolve the current application path that should be replaced. */
function currentAppPath(): string {
  if (isMac) {
    // Electron app path on macOS: /Applications/AttaSeek.app
    const exePath = app.getPath('exe')
    // exePath is .../AttaSeek.app/Contents/MacOS/AttaSeek
    return exePath.split('/Contents/MacOS/')[0] || '/Applications/AttaSeek.app'
  }
  if (isWindows) {
    // exePath is e.g. C:\Program Files\AttaSeek\AttaSeek.exe
    return app.getPath('exe')
  }
  // Linux: AppImage or installed binary
  return app.getPath('exe')
}

/** Path for version backup storage. */
function versionBackupDir(version: string): string {
  return join(dataDir(), 'versions', `v${version}`)
}

/** Ensure the versions directory exists. */
async function ensureVersionsDir(): Promise<void> {
  const dir = join(dataDir(), 'versions')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

// ── macOS Installer ──

async function installMac(downloadPath: string, currentVersion: string): Promise<void> {
  // Backup current version
  await ensureVersionsDir()
  const backupDir = versionBackupDir(currentVersion)
  const currentApp = currentAppPath()
  if (existsSync(currentApp) && !existsSync(backupDir)) {
    await mkdir(backupDir, { recursive: true })
    await new Promise<void>((resolve, reject) => {
      execFile('cp', ['-R', currentApp, backupDir], (err) => {
        if (err) reject(err); else resolve()
      })
    })
    console.log(`[update] backed up v${currentVersion} to ${backupDir}`)
  }

  // Mount DMG
  const mountPoint = await new Promise<string>((resolve, reject) => {
    execFile('hdiutil', ['attach', '-nobrowse', '-noautoopen', downloadPath], (err, stdout) => {
      if (err) return reject(new Error(`hdiutil attach failed: ${err.message}`))
      // Parse mount point from output: "/dev/disk4 ... /Volumes/AttaSeek"
      const lines = stdout.split('\n')
      for (const line of lines) {
        const parts = line.split('\t')
        if (parts.length >= 3) {
          const mp = parts[2].trim()
          if (mp.startsWith('/Volumes/')) return resolve(mp)
        }
      }
      // Fallback: try common path
      resolve('/Volumes/AttaSeek')
    })
  })

  try {
    // Find .app bundle in the mounted volume
    const appBundle = join(mountPoint, 'AttaSeek.app')
    if (!existsSync(appBundle)) {
      throw new Error(`App bundle not found in DMG at ${appBundle}`)
    }

    // Copy .app to current install location
    const targetApp = currentAppPath()
    await new Promise<void>((resolve, reject) => {
      execFile('cp', ['-R', appBundle, targetApp], (err) => {
        if (err) reject(new Error(`cp failed: ${err.message}`)); else resolve()
      })
    })
    console.log(`[update] installed new version to ${targetApp}`)
  } finally {
    // Always detach
    execFile('hdiutil', ['detach', mountPoint], () => { /* ignore detach errors */ })
  }
}

// ── Windows Installer ──

async function installWindows(downloadPath: string, currentVersion: string): Promise<void> {
  await ensureVersionsDir()
  const backupDir = versionBackupDir(currentVersion)
  const currentExe = currentAppPath()
  if (existsSync(currentExe) && !existsSync(backupDir)) {
    await mkdir(backupDir, { recursive: true })
    await copyFile(currentExe, join(backupDir, basename(currentExe)))
    console.log(`[update] backed up v${currentVersion} to ${backupDir}`)
  }

  // Run NSIS installer silently
  // /S = silent, /D=... = install directory
  const installDir = currentExe.replace(/[^\\/]+$/, '')
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(downloadPath, ['/S', `/D=${installDir}`], {
      stdio: 'ignore',
      detached: true,
    })
    proc.on('error', (err) => reject(new Error(`NSIS installer failed: ${err.message}`)))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`NSIS installer exited with code ${code}`))
    })
  })
  console.log(`[update] NSIS installer completed`)
}

// ── Linux Installer ──

async function installLinux(downloadPath: string, currentVersion: string): Promise<void> {
  await ensureVersionsDir()
  const backupDir = versionBackupDir(currentVersion)
  const currentApp = currentAppPath()
  if (existsSync(currentApp) && !existsSync(backupDir)) {
    await mkdir(backupDir, { recursive: true })
    // For AppImage, just copy the file
    const backupName = basename(currentApp) || 'AttaSeek.AppImage'
    await copyFile(currentApp, join(backupDir, backupName))
    console.log(`[update] backed up v${currentVersion} to ${backupDir}`)
  }

  // Replace AppImage
  const targetPath = currentApp
  const tempTarget = targetPath + '.new'
  await copyFile(downloadPath, tempTarget)
  // Make executable
  await new Promise<void>((resolve, reject) => {
    execFile('chmod', ['+x', tempTarget], (err) => {
      if (err) reject(err); else resolve()
    })
  })
  // Atomic rename
  await rename(tempTarget, targetPath)
  console.log(`[update] replaced AppImage at ${targetPath}`)
}

// ── Public API ──

export async function installUpdate(downloadPath: string, currentVersion: string): Promise<void> {
  if (isMac) return installMac(downloadPath, currentVersion)
  if (isWindows) return installWindows(downloadPath, currentVersion)
  if (isLinux) return installLinux(downloadPath, currentVersion)
  throw new Error(`Unsupported platform: ${osPlatform()}`)
}
