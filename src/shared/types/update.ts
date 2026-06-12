/**
 * Update system — shared types usable by both main and renderer processes.
 */

export type UpdateChannel = 'stable' | 'beta' | 'nightly'
export type UpdateUrgency = 'latest' | 'recommended' | 'critical'
export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'error'
export type UpdateErrorCode = 'NETWORK' | 'VERIFY_FAILED' | 'INSTALL_FAILED' | 'UNKNOWN'

export interface UpdateManifest {
  version: string
  platform: string
  url: string
  size: number
  sha256: string
  signature?: string             // reserved, not yet enforced
  changelogUrl: string
  publishedAt: number
  urgency: UpdateUrgency
  minUpgradableVersion?: string  // null = any version can upgrade directly
}

export interface UpdateProgress {
  downloadedBytes: number
  totalBytes: number
  percent: number
  bytesPerSecond: number
  etaSeconds: number
}

export interface UpdateStatus {
  state: UpdateState
  manifest?: UpdateManifest
  progress?: UpdateProgress
  lastChecked?: number
  error?: string
  errorCode?: UpdateErrorCode
  canRetry: boolean
  retryCount: number
}

export type UpdateEvent =
  | { type: 'check-started' }
  | { type: 'update-available'; manifest: UpdateManifest }
  | { type: 'no-update' }
  | { type: 'download-started'; size: number }
  | { type: 'download-progress'; progress: UpdateProgress }
  | { type: 'download-complete'; progress?: UpdateProgress }
  | { type: 'ready-to-install'; manifest: UpdateManifest }
  | { type: 'install-started' }
  | { type: 'error'; message: string; code: string; canRetry: boolean }

export interface UpdateSettings {
  channel: UpdateChannel
  autoDownload: boolean
  checkOnStartup: boolean
}
