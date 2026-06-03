import { useAtom } from 'jotai'
import { themeAtom, type Theme } from '../../../atoms/themeAtom'
import { Sun, Moon, Monitor } from 'lucide-react'

const THEME_OPTIONS: {
  value: Theme
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor }
]

export default function AppearanceSettings() {
  const [theme, setTheme] = useAtom(themeAtom)

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--app-text)] mb-4">Appearance</h3>
      <div className="space-y-4">
        {/* Theme selector */}
        <div>
          <p className="text-xs text-[var(--app-text-secondary)] mb-2">Base theme</p>
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg border transition-colors
                  ${
                    theme === value
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-[var(--app-border)] text-[var(--app-text-secondary)] hover:border-[var(--app-text-dim)] hover:text-[var(--app-text)]'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px]">{label}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Font selectors */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--app-text-secondary)]">UI font</p>
            <p className="text-[11px] text-[var(--app-text-dim)]">SF Pro (system)</p>
          </div>
          <span className="text-[11px] text-[var(--app-text-secondary)] border border-[var(--app-border)] rounded px-2 py-0.5">
            System ▾
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--app-text-secondary)]">Code font</p>
            <p className="text-[11px] text-[var(--app-text-dim)]">JetBrains Mono</p>
          </div>
          <span className="text-[11px] text-[var(--app-text-secondary)] border border-[var(--app-border)] rounded px-2 py-0.5">
            JetBrains ▾
          </span>
        </div>
      </div>
    </div>
  )
}
