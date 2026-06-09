import { useState, useRef, useEffect } from 'react'
import { Monitor, ChevronDown, Globe, Terminal, FolderOpen } from 'lucide-react'

const MENU_ITEMS = [
  { id: 'browser', label: 'Browser', icon: Globe },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'finder', label: 'Finder', icon: FolderOpen }
] as const

export default function AppLauncher() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 px-1 h-6 rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
        title="Launch app"
        aria-label="Launch app"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Monitor className="w-3.5 h-3.5" />
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg z-50 py-1">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => {
                  setOpen(false)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
