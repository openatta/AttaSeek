import { useTranslation } from '../../../i18n'

const defaults = [
  { key: '⌘+Enter', i18nCmd: 'keyboard.send', when: 'Composer focused' },
  { key: 'Escape', i18nCmd: 'keyboard.clear', when: 'Composer focused' },
  { key: '⌘+K', i18nCmd: 'keyboard.clear', when: 'Composer focused' },
]

export default function KeyboardSettings() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">{t('keyboard.title')}</h2>
      <p className="text-[10px] text-[var(--app-text-dim)]">{t('keyboard.desc')} <code className="text-[var(--app-accent)]">~/.atta/seek/keybindings.json</code></p>
      <div className="space-y-1">
        {defaults.map((k, i) => (
          <div key={i} className="flex items-center gap-4 py-2 border-b border-[var(--app-border)] text-xs">
            <code className="bg-[var(--app-bg-inset)] px-2 py-0.5 rounded text-[var(--app-accent)] w-24 text-center">{k.key}</code>
            <span className="text-[var(--app-text)] flex-1">{t(k.i18nCmd)}</span>
            <span className="text-[var(--app-text-dim)]">{k.when}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
