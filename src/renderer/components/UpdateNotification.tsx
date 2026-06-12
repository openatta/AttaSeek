/**
 * UpdateNotification — non-blocking banner for auto-update status.
 *
 * Subscribes to the main process update:event push channel and renders
 * contextual UI based on the current update state:
 *   available   → version info + download / skip buttons
 *   downloading → progress bar
 *   ready       → restart to install
 *   error       → error message + retry button
 */

import { useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { updateStatusAtom, updateNotificationVisibleAtom, lastUpdateEventAtom } from '../atoms/updateAtom'
import type { UpdateStatus, UpdateEvent, UpdateProgress } from '../../shared/types/update'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return ''
  if (seconds < 60) return `${seconds}s`
  return `${Math.ceil(seconds / 60)}m`
}

export function ProgressBar({ progress }: { progress: UpdateProgress }) {
  const pct = Math.min(progress.percent, 100)
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[10px] text-[var(--app-text-dim)] mb-1">
        <span>{formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}</span>
        <span>{pct}% {progress.etaSeconds > 0 ? `· ${formatEta(progress.etaSeconds)} remaining` : ''}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-[var(--app-bg-inset)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--app-accent)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function UpdateNotification() {
  const [status, setStatus] = useAtom(updateStatusAtom)
  const [visible, setVisible] = useAtom(updateNotificationVisibleAtom)
  const setLastEvent = useSetAtom(lastUpdateEventAtom)

  // Subscribe to push events from main process
  useEffect(() => {
    const unsubscribe = window.api?.update?.onEvent((event: UpdateEvent) => {
      setLastEvent(event)
      setVisible(true) // Show notification on new event

      setStatus((prev: UpdateStatus) => {
        switch (event.type) {
          case 'check-started':
            return { ...prev, state: 'checking' }
          case 'update-available':
            return { ...prev, state: 'available', manifest: event.manifest }
          case 'no-update':
            return { ...prev, state: 'idle' }
          case 'download-started':
            return { ...prev, state: 'downloading', progress: { downloadedBytes: 0, totalBytes: event.size, percent: 0, bytesPerSecond: 0, etaSeconds: 0 } }
          case 'download-progress':
            return { ...prev, progress: event.progress }
          case 'download-complete':
            return { ...prev, state: 'ready', progress: event.progress ?? prev.progress }
          case 'ready-to-install':
            return { ...prev, state: 'ready', manifest: event.manifest }
          case 'install-started':
            return { ...prev, state: 'installing' }
          case 'error':
            return { ...prev, state: 'error', error: event.message, errorCode: event.code as UpdateStatus['errorCode'], canRetry: event.canRetry }
          default:
            return prev
        }
      })
    })

    // Also query current status on mount
    window.api?.update?.getStatus().then((res: { success: boolean; status?: UpdateStatus }) => {
      if (res.success && res.status) {
        setStatus((prev: UpdateStatus) => ({ ...prev, ...res.status }))
      }
    })

    return unsubscribe
  }, [])

  // Don't render when idle/checking or user dismissed
  if (!visible || status.state === 'idle' || status.state === 'checking') return null

  const handleDownload = () => window.api?.update?.download()
  const handleInstall = () => window.api?.update?.install()
  const handleSkip = () => {
    if (status.manifest) {
      window.api?.update?.skipVersion(status.manifest.version)
    }
    setVisible(false)
  }
  const handleDismiss = () => setVisible(false)
  const handleRetry = () => {
    if (status.state === 'error') {
      window.api?.update?.download()
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none pt-2">
      <div className="pointer-events-auto max-w-lg w-full mx-4 px-4 py-3 rounded-lg shadow-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text)] text-xs">
        {status.state === 'available' && status.manifest && (
          <div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                AttaSeek {status.manifest.version} available
                {status.manifest.urgency === 'critical' && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-red-500/15 text-red-500">
                    Security update
                  </span>
                )}
              </span>
              <button onClick={handleDismiss} className="text-[var(--app-text-dim)] hover:text-[var(--app-text)] text-[10px]">
                ✕
              </button>
            </div>
            <p className="mt-1 text-[10px] text-[var(--app-text-dim)]">
              {status.manifest.size > 0 ? formatBytes(status.manifest.size) : ''}
              {status.manifest.changelogUrl && (
                <> · <a href={status.manifest.changelogUrl} className="underline" target="_blank">Release notes</a></>
              )}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleDownload}
                className="px-3 py-1 rounded-md bg-[var(--app-accent)] text-white text-[10px] font-medium hover:opacity-90"
              >
                Download update
              </button>
              {status.manifest.urgency !== 'critical' && (
                <button
                  onClick={handleSkip}
                  className="px-3 py-1 rounded-md border border-[var(--app-border)] text-[var(--app-text-dim)] text-[10px] hover:text-[var(--app-text)]"
                >
                  Skip this version
                </button>
              )}
            </div>
          </div>
        )}

        {status.state === 'downloading' && status.progress && (
          <div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Downloading update{status.manifest ? ` v${status.manifest.version}` : ''}…</span>
              {status.manifest?.urgency !== 'critical' && (
                <button onClick={handleDismiss} className="text-[var(--app-text-dim)] hover:text-[var(--app-text)] text-[10px]">
                  ✕
                </button>
              )}
            </div>
            <ProgressBar progress={status.progress} />
          </div>
        )}

        {status.state === 'ready' && (
          <div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Update ready — restart to install{status.manifest ? ` v${status.manifest.version}` : ''}</span>
              <button onClick={handleDismiss} className="text-[var(--app-text-dim)] hover:text-[var(--app-text)] text-[10px]">
                ✕
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleInstall}
                className="px-3 py-1 rounded-md bg-[var(--app-accent)] text-white text-[10px] font-medium hover:opacity-90"
              >
                Restart now
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1 rounded-md border border-[var(--app-border)] text-[var(--app-text-dim)] text-[10px] hover:text-[var(--app-text)]"
              >
                Later
              </button>
            </div>
          </div>
        )}

        {status.state === 'installing' && (
          <div>
            <span className="font-semibold">Installing update… Restarting…</span>
          </div>
        )}

        {status.state === 'error' && (
          <div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-red-500">Update failed</span>
              <button onClick={handleDismiss} className="text-[var(--app-text-dim)] hover:text-[var(--app-text)] text-[10px]">
                ✕
              </button>
            </div>
            <p className="mt-1 text-[10px] text-[var(--app-text-dim)]">
              {status.error || 'An unexpected error occurred'}
            </p>
            {status.canRetry && (
              <button
                onClick={handleRetry}
                className="mt-2 px-3 py-1 rounded-md border border-[var(--app-border)] text-[var(--app-text)] text-[10px] hover:bg-[var(--app-bg-hover)]"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
