import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import { useAtom } from 'jotai'
import { themeAtom } from '../../atoms/themeAtom'

export default function SystemInfoPopup() {
  const [open, setOpen] = useState(true)
  const [theme] = useAtom(themeAtom)
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
        className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
        title="System info"
        aria-label="System info"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Info className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg z-50 p-3">
          <h4 className="text-xs font-semibold text-[var(--app-text)] mb-2">System</h4>
          <div className="space-y-1.5">
            {[
              { label: 'App', value: 'AttaSeek' },
              { label: 'Version', value: '0.1.0' },
              { label: 'Environment', value: 'development' },
              { label: 'Theme', value: theme }
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--app-text-dim)]">{row.label}</span>
                <span className="text-[var(--app-text-secondary)]">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
