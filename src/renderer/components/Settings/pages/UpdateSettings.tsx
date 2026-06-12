/**
 * UpdateSettings — auto-update preferences.
 *
 * Allows users to:
 *   - Choose update channel (stable / beta / nightly)
 *   - Toggle auto-download
 *   - Toggle check on startup
 *   - Manually check for updates
 *   - See current version
 */

import { useState, useEffect, useCallback } from 'react'
import { useAtom } from 'jotai'
import { updateStatusAtom } from '../../../atoms/updateAtom'
import { useTranslation } from '../../../i18n'
import { ProgressBar } from '../../UpdateNotification'
import type { UpdateChannel, UpdateStatus } from '../../../../shared/types/update'

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--app-border)]">
      <div>
        <p className="text-xs text-[var(--app-text)]">{label}</p>
        {desc && <p className="text-[10px] text-[var(--app-text-dim)]">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

export default function UpdateSettings() {
  const { t } = useTranslation()
  const [channel, setChannel] = useState<UpdateChannel>('stable')
  const [autoDownload, setAutoDownload] = useState(true)
  const [checkOnStartup, setCheckOnStartup] = useState(true)
  const [currentVersion, setCurrentVersion] = useState('')
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useAtom(updateStatusAtom)
  const [message, setMessage] = useState('')

  // Load settings from main process
  useEffect(() => {
    window.api?.update?.getSettings().then((res) => {
      if (res.success && res.settings) {
        setChannel(res.settings.channel)
        setAutoDownload(res.settings.autoDownload)
        setCheckOnStartup(res.settings.checkOnStartup)
      }
    })
    // Get current version from preload
    if (window.api?.version) setCurrentVersion(window.api.version)
  }, [])

  const saveSetting = useCallback((key: string, value: unknown) => {
    window.api?.update?.setSettings({ [key]: value })
  }, [])

  const handleChannelChange = (newChannel: UpdateChannel) => {
    setChannel(newChannel)
    saveSetting('channel', newChannel)
  }

  const handleAutoDownloadChange = (val: boolean) => {
    setAutoDownload(val)
    saveSetting('autoDownload', val)
  }

  const handleCheckStartupChange = (val: boolean) => {
    setCheckOnStartup(val)
    saveSetting('checkOnStartup', val)
  }

  const handleCheckNow = async () => {
    setChecking(true)
    setMessage('')
    try {
      const res = await window.api?.update?.check()
      if (res?.success) {
        if (res.manifest) {
          setMessage(`New version ${res.manifest.version} found!`)
        } else {
          setMessage('AttaSeek is up to date')
        }
      } else {
        setMessage(res?.error || 'Check failed')
      }
    } catch {
      setMessage('Unable to check for updates')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">{t('updates.title', 'Updates')}</h2>

      <Row label={t('updates.currentVersion', 'Current version')} desc={currentVersion || 'Unknown'}>
        <span className="text-xs text-[var(--app-text-dim)]">{currentVersion || '...'}</span>
      </Row>

      <Row label={t('updates.channel', 'Update channel')} desc={t('updates.channel.desc', 'Choose which release track to follow')}>
        <select
          value={channel}
          onChange={(e) => handleChannelChange(e.target.value as UpdateChannel)}
          className="w-28 px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)]"
        >
          <option value="stable">Stable</option>
          <option value="beta">Beta</option>
          <option value="nightly">Nightly</option>
        </select>
      </Row>

      <Row label={t('updates.autoDownload', 'Auto-download')} desc={t('updates.autoDownload.desc', 'Download updates in the background')}>
        <button
          onClick={() => handleAutoDownloadChange(!autoDownload)}
          aria-label={t('updates.autoDownload', 'Auto-download')}
          aria-pressed={autoDownload}
          className={`w-9 h-5 rounded-full transition-colors ${autoDownload ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-border)]'}`}
        >
          <div className={`w-3.5 h-3.5 mt-0.5 rounded-full bg-white transition-transform ${autoDownload ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
        </button>
      </Row>

      <Row label={t('updates.checkOnStartup', 'Check on startup')} desc={t('updates.checkOnStartup.desc', 'Check for updates when AttaSeek starts')}>
        <button
          onClick={() => handleCheckStartupChange(!checkOnStartup)}
          aria-label={t('updates.checkOnStartup', 'Check on startup')}
          aria-pressed={checkOnStartup}
          className={`w-9 h-5 rounded-full transition-colors ${checkOnStartup ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-border)]'}`}
        >
          <div className={`w-3.5 h-3.5 mt-0.5 rounded-full bg-white transition-transform ${checkOnStartup ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
        </button>
      </Row>

      <div className="pt-2">
        <button
          onClick={handleCheckNow}
          disabled={checking}
          className="px-4 py-1.5 rounded-md bg-[var(--app-accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {checking ? t('updates.checking', 'Checking…') : t('updates.checkNow', 'Check for updates')}
        </button>
        {message && (
          <p className="mt-2 text-[11px] text-[var(--app-text-dim)]">{message}</p>
        )}
      </div>

      {status.state !== 'idle' && status.state !== 'checking' && status.manifest && (
        <div className="mt-4 p-3 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)]">
          <p className="text-xs font-medium text-[var(--app-text)]">
            {status.state === 'available' && `AttaSeek ${status.manifest.version} is available`}
            {status.state === 'downloading' && 'Downloading update…'}
            {status.state === 'ready' && 'Update ready to install'}
            {status.state === 'error' && 'Update failed'}
          </p>
          {status.progress && status.state === 'downloading' && (
            <ProgressBar progress={status.progress} />
          )}
        </div>
      )}
    </div>
  )
}
