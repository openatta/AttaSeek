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
      <h3 className="text-sm font-semibold text-neutral-200 mb-4">Appearance</h3>
      <div className="space-y-4">
        {/* Theme selector */}
        <div>
          <p className="text-xs text-neutral-300 mb-2">Base theme</p>
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg border transition-colors
                  ${
                    theme === value
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-400'
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
            <p className="text-xs text-neutral-300">UI font</p>
            <p className="text-[11px] text-neutral-500">SF Pro (system)</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">
            System ▾
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300">Code font</p>
            <p className="text-[11px] text-neutral-500">JetBrains Mono</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">
            JetBrains ▾
          </span>
        </div>
      </div>
    </div>
  )
}
