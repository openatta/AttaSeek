import { useState, useEffect } from 'react'
import { useTranslation } from '../../../i18n'
import { getApi } from '../../../utils/api'

interface ShortcutEntry {
  key: string
  label: string
  when: string
  global?: boolean
}

const defaults: ShortcutEntry[] = [
  { key: 'Cmd+Enter / Ctrl+Enter', label: 'Send message', when: 'Composer focused' },
  { key: 'Escape', label: 'Clear composer', when: 'Composer focused' },
  { key: 'Cmd+K / Ctrl+K', label: 'Clear composer', when: 'Composer focused' },
  { key: 'Cmd+N / Ctrl+N', label: 'New chat', when: 'Application' },
  { key: 'Cmd+, / Ctrl+,', label: 'Open settings', when: 'Application' },
]

export default function KeyboardSettings() {
  const { t } = useTranslation()
  const [globalShortcut, setGlobalShortcut] = useState('')

  useEffect(() => {
    const api = getApi()
    api.tray.getPlatformInfo().then(info => {
      setGlobalShortcut(info.platform === 'darwin' ? '⌘+Shift+G' : 'Ctrl+Shift+G')
    }).catch(() => {
      setGlobalShortcut('⌘+Shift+G')
    })
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">{t('keyboard.title')}</h2>
      <p className="text-[10px] text-[var(--app-text-dim)]">
        Configure keyboard shortcuts. Edit <code className="text-[var(--app-accent)]">~/.atta/seek/keybindings.json</code> for advanced customization.
      </p>

      {/* Global shortcut */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">Global</h3>
        <div className="space-y-1">
          <div className="flex items-center gap-4 py-2 border-b border-[var(--app-border)] text-xs">
            <code className="bg-[var(--app-bg-inset)] px-2 py-0.5 rounded text-[var(--app-accent)] w-28 text-center">{globalShortcut || '...'}</code>
            <span className="text-[var(--app-text)] flex-1">Show/Hide AttaSeek</span>
            <span className="text-[var(--app-text-dim)]">System-wide</span>
          </div>
        </div>
      </div>

      {/* In-app shortcuts */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">In-App</h3>
        <div className="space-y-1">
          {defaults.filter(k => !k.global).map((k, i) => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-[var(--app-border)] text-xs">
              <code className="bg-[var(--app-bg-inset)] px-2 py-0.5 rounded text-[var(--app-accent)] w-28 text-center">{k.key}</code>
              <span className="text-[var(--app-text)] flex-1">{k.label}</span>
              <span className="text-[var(--app-text-dim)]">{k.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
