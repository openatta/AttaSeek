/**
 * UpdateManager — central state machine for the auto-update lifecycle.
 *
 * States: idle → checking → available → downloading → ready → installing → error
 *
 * Coordinates:
 *   UpdateSource (check) → download stream → UpdateVerifier → UpdateInstaller
 *
 * Events are pushed to the renderer via the onEvent callback registered
 * by the IPC layer (update:event push channel).
 *
 * Periodic checks run on a configurable interval (default 4 hours).
 */

import { app, net } from 'electron'
import { platform as osPlatform, arch as osArch } from 'os'
import { createWriteStream, existsSync, statSync, unlinkSync, renameSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { CompositeUpdateSource, GitHubReleaseSource, AttaCloudSource } from './UpdateSource'
import { verifyUpdate } from './UpdateVerifier'
import { installUpdate } from './UpdateInstaller'
import { parseVersion, isNewer, toChannel } from './version-utils'
import { dataDir } from '../store/paths'
import { JSONStore } from '../store/FileStore'
import type {
  UpdateState, UpdateStatus, UpdateManifest, UpdateProgress,
  UpdateEvent, UpdateErrorCode, UpdateSettings,
} from '../../shared/types/update'

// ── Constants ──

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 5_000
const DOWNLOAD_DIR = join(dataDir(), 'downloads')

// ── Persisted state ──

interface UpdatePersistedState {
  skippedVersions: string[]
  lastChecked: number
  channel: string
  autoDownload: boolean
  checkOnStartup: boolean
  [key: string]: unknown
}

const stateStore = new JSONStore<UpdatePersistedState>(
  join(dataDir(), 'update_state.json'),
)

// ── UpdateManager singleton ──

class UpdateManager {
  private state: UpdateState = 'idle'
  private manifest: UpdateManifest | null = null
  private progress: UpdateProgress | null = null
  private error: string | null = null
  private errorCode: UpdateErrorCode | null = null
  private canRetry = true
  private retryCount = 0
  private downloadPath: string | null = null
  private listeners: Array<(event: UpdateEvent) => void> = []
  private periodicTimer: ReturnType<typeof setInterval> | null = null
  private source = new CompositeUpdateSource(
    new GitHubReleaseSource(),
    new AttaCloudSource(),
  )
  private started = false

  // ── Public API: lifecycle ──

  /** Start the update manager — load persisted state and optionally check on startup. */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true

    const persisted = await this.loadPersisted()
    if (persisted.checkOnStartup) {
      // Defer check to avoid slowing down app startup
      setTimeout(() => this.check(), 3_000)
    }
    this.startPeriodicCheck()
    console.log('[update] manager started')
  }

  /** Stop periodic checks (called on app quit). */
  stop(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer)
      this.periodicTimer = null
    }
    this.started = false
  }

  /** Register an event listener. Returns unsubscribe function. */
  onEvent(cb: (event: UpdateEvent) => void): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb)
    }
  }

  // ── Public API: actions ──

  /** Check for updates (manual or periodic). */
  async check(): Promise<UpdateStatus> {
    if (this.state === 'downloading' || this.state === 'installing') {
      return this.getStatus() // already in progress
    }

    this.transition('checking')
    this.emit({ type: 'check-started' })

    try {
      const currentVersion = app.getVersion()
      const platform = osPlatform()
      const arch = osArch()
      const persisted = await this.loadPersisted()
      const channel = toChannel(persisted.channel)

      const manifest = await this.source.fetch(currentVersion, platform, arch, channel)
      await this.persistLastChecked()

      if (!manifest) {
        this.emit({ type: 'no-update' })
        this.transition('idle')
        return this.getStatus()
      }

      // Skip versions the user has explicitly skipped
      const { skippedVersions } = await this.loadPersisted()
      if (skippedVersions.includes(manifest.version)) {
        console.log(`[update] version ${manifest.version} is skipped`)
        this.emit({ type: 'no-update' })
        this.transition('idle')
        return this.getStatus()
      }

      // Check minimum upgradable version
      if (manifest.minUpgradableVersion) {
        const curVer = parseVersion(currentVersion)
        const minVer = parseVersion(manifest.minUpgradableVersion)
        if (curVer < minVer) {
          console.log(`[update] version ${manifest.version} requires at least ${manifest.minUpgradableVersion}`)
          this.emit({ type: 'no-update' })
          this.transition('idle')
          return this.getStatus()
        }
      }

      // Check if newer than current
      if (!isNewer(manifest.version, currentVersion)) {
        this.emit({ type: 'no-update' })
        this.transition('idle')
        return this.getStatus()
      }

      this.manifest = manifest
      this.transition('available')
      this.emit({ type: 'update-available', manifest })

      // Auto-download for critical updates, or if autoDownload is enabled
      if (manifest.urgency === 'critical') {
        await this.download()
      } else if ((await this.loadPersisted()).autoDownload) {
        await this.download()
      }

      return this.getStatus()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('[update] check failed:', message)
      this.setError(message, 'NETWORK')
      this.transition('error')
      return this.getStatus()
    }
  }

  /** Download the available update. */
  async download(): Promise<UpdateStatus> {
    if (!this.manifest || (this.state !== 'available' && this.state !== 'error')) {
      return this.getStatus()
    }

    this.transition('downloading')
    this.retryCount = 0
    this.canRetry = true

    try {
      await this.doDownload()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed'
      this.setError(message, 'NETWORK')
      this.transition('error')
    }
    return this.getStatus()
  }

  /** Install the downloaded update and restart. */
  async install(): Promise<void> {
    if (this.state !== 'ready' || !this.manifest || !this.downloadPath) {
      throw new Error('Update not ready for install')
    }

    this.transition('installing')
    this.emit({ type: 'install-started' })

    try {
      await installUpdate(this.downloadPath, app.getVersion())
      // Success — quit and relaunch
      console.log('[update] install complete, relaunching')
      app.relaunch()
      app.quit()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Install failed'
      this.setError(message, 'INSTALL_FAILED')
      this.transition('error')
      throw err
    }
  }

  /** Skip a specific version. */
  async skipVersion(version: string): Promise<void> {
    const persisted = await this.loadPersisted()
    if (!persisted.skippedVersions.includes(version)) {
      persisted.skippedVersions.push(version)
      // Keep only last 20 skipped versions
      if (persisted.skippedVersions.length > 20) {
        persisted.skippedVersions = persisted.skippedVersions.slice(-20)
      }
    }
    await stateStore.write(persisted)
    if (this.state === 'available') {
      this.transition('idle')
    }
    console.log(`[update] skipping version ${version}`)
  }

  /** Get current status snapshot. */
  async getStatus(): Promise<UpdateStatus> {
    const p = await this.loadPersisted()
    return {
      state: this.state,
      manifest: this.manifest ?? undefined,
      progress: this.progress ?? undefined,
      lastChecked: p.lastChecked ?? undefined,
      error: this.error ?? undefined,
      errorCode: this.errorCode ?? undefined,
      canRetry: this.canRetry,
      retryCount: this.retryCount,
    }
  }

  /** Get current update settings. */
  async getSettings(): Promise<UpdateSettings> {
    const p = await this.loadPersisted()
    return {
      channel: toChannel(p.channel),
      autoDownload: p.autoDownload,
      checkOnStartup: p.checkOnStartup,
    }
  }

  /** Update settings. */
  async updateSettings(patch: Partial<UpdateSettings>): Promise<void> {
    const p = await this.loadPersisted()
    if (patch.channel !== undefined) p.channel = patch.channel
    if (patch.autoDownload !== undefined) p.autoDownload = patch.autoDownload
    if (patch.checkOnStartup !== undefined) p.checkOnStartup = patch.checkOnStartup
    await stateStore.write(p)
  }

  // ── Private ──

  private startPeriodicCheck(): void {
    if (this.periodicTimer) clearInterval(this.periodicTimer)
    // Offset slightly to avoid exact-hour spikes
    const offset = Math.floor(Math.random() * 600_000) // 0-10min jitter
    this.periodicTimer = setInterval(() => {
      if (this.state === 'idle' || this.state === 'error') {
        this.check()
      }
    }, CHECK_INTERVAL_MS + offset)
  }

  private async doDownload(): Promise<void> {
    const manifest = this.manifest!
    const downloadPath = join(DOWNLOAD_DIR, `AttaSeek-${manifest.version}-${manifest.platform}.part`)

    // Ensure download directory exists
    if (!existsSync(DOWNLOAD_DIR)) await mkdir(DOWNLOAD_DIR, { recursive: true })

    // Check for existing partial download (resume support)
    let downloadedBytes = 0
    if (existsSync(downloadPath)) {
      downloadedBytes = statSync(downloadPath).size
    }

    this.progress = { downloadedBytes, totalBytes: manifest.size, percent: 0, bytesPerSecond: 0, etaSeconds: 0 }
    this.emit({ type: 'download-started', size: manifest.size })

    const startTime = Date.now()
    let lastBytes = downloadedBytes
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      const currentBytes = this.progress!.downloadedBytes
      const bytesPerSecond = elapsed > 0 ? (currentBytes - lastBytes) / Math.max(elapsed, 1) : 0
      lastBytes = currentBytes
      this.progress = {
        downloadedBytes: currentBytes,
        totalBytes: manifest.size,
        percent: manifest.size > 0 ? Math.round((currentBytes / manifest.size) * 100) : 0,
        bytesPerSecond,
        etaSeconds: bytesPerSecond > 0 ? Math.ceil((manifest.size - currentBytes) / bytesPerSecond) : 0,
      }
      this.emit({ type: 'download-progress', progress: this.progress })
    }, 500)

    try {
      await this.downloadFile(manifest.url, downloadPath, downloadedBytes)
      clearInterval(progressInterval)

      // Verify
      const result = await verifyUpdate(downloadPath, manifest.sha256)
      if (!result.passed) {
        unlinkSync(downloadPath)
        throw new Error(result.reason || 'Verification failed')
      }

      // Rename from .part to final
      const finalPath = downloadPath.replace(/\.part$/, '')
      if (existsSync(finalPath)) unlinkSync(finalPath)
      renameSync(downloadPath, finalPath)
      this.downloadPath = finalPath

      this.progress = { downloadedBytes: manifest.size, totalBytes: manifest.size, percent: 100, bytesPerSecond: 0, etaSeconds: 0 }
      this.emit({ type: 'download-complete' })
      this.transition('ready')
      this.emit({ type: 'ready-to-install', manifest })
    } catch (err) {
      clearInterval(progressInterval)
      if (this.retryCount < MAX_RETRIES) {
        this.retryCount++
        console.warn(`[update] download attempt ${this.retryCount} failed, retrying in ${RETRY_DELAY_MS}ms`)
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
        return this.doDownload()
      }
      // Clean up partial download on final failure
      try { if (existsSync(downloadPath)) unlinkSync(downloadPath) } catch { /* ignore */ }
      throw err
    }
  }

  private downloadFile(url: string, destPath: string, resumeBytes: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {}
      if (resumeBytes > 0) {
        headers['Range'] = `bytes=${resumeBytes}-`
      }

      const request = net.request({ url, headers })
      let totalSize = resumeBytes

      request.on('response', (response) => {
        if (response.statusCode && response.statusCode >= 400 && response.statusCode !== 206) {
          return reject(new Error(`HTTP ${response.statusCode}`))
        }

        const writeStream = createWriteStream(destPath, { flags: resumeBytes > 0 ? 'a' : 'w' })

        writeStream.on('error', (err) => {
          reject(new Error(`Write error: ${err.message}`))
        })

        response.on('data', (chunk: Buffer) => {
          totalSize += chunk.length
          this.progress!.downloadedBytes = totalSize
          const ok = writeStream.write(chunk)
          // Pause the response stream if the write buffer is full;
          // resume once the drain event fires.
          if (!ok) {
            response.pause()
            writeStream.once('drain', () => response.resume())
          }
        })

        response.on('end', () => {
          writeStream.end(() => resolve())
        })

        response.on('error', (err) => {
          writeStream.close()
          reject(err)
        })
      })

      request.on('error', reject)
      request.end()
    })
  }

  private transition(newState: UpdateState): void {
    this.state = newState
    if (newState === 'idle') {
      this.progress = null
      this.error = null
      this.errorCode = null
      this.canRetry = true
      this.retryCount = 0
    }
  }

  private setError(message: string, code: UpdateErrorCode): void {
    this.error = message
    this.errorCode = code
    this.canRetry = code !== 'VERIFY_FAILED'
    this.emit({ type: 'error', message, code, canRetry: this.canRetry })
  }

  private emit(event: UpdateEvent): void {
    for (const listener of this.listeners) {
      try { listener(event) } catch { /* ignore listener errors */ }
    }
  }

  // parseVersion, isNewer, toChannel are imported from ./version-utils

  private async loadPersisted(): Promise<UpdatePersistedState> {
    const data = await stateStore.read()
    return {
      skippedVersions: Array.isArray(data.skippedVersions) ? data.skippedVersions : [],
      lastChecked: typeof data.lastChecked === 'number' ? data.lastChecked : 0,
      channel: typeof data.channel === 'string' ? data.channel : 'stable',
      autoDownload: typeof data.autoDownload === 'boolean' ? data.autoDownload : true,
      checkOnStartup: typeof data.checkOnStartup === 'boolean' ? data.checkOnStartup : true,
    }
  }

  private async persistLastChecked(): Promise<void> {
    const p = await this.loadPersisted()
    p.lastChecked = Date.now()
    await stateStore.write(p as UpdatePersistedState)
  }
}

/** Singleton instance. Created eagerly so IPC handlers can reference it. */
export const updateManager = new UpdateManager()
