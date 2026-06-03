import { useState } from 'react'
import { Info } from 'lucide-react'
import { useAtom } from 'jotai'
import { themeAtom } from '../../atoms/themeAtom'

export function SystemInfoToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
      title="System info"
      aria-label="System info"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <Info className="w-4 h-4" />
    </button>
  )
}

export function SystemInfoPanel({ open }: { open: boolean }) {
  const [theme] = useAtom(themeAtom)

  if (!open) return null

  return (
    <div className="absolute right-4 top-[48px] w-60 bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg z-50 p-3">
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
  )
}

/**
 * Combined component for backward compat — renders toggle + panel.
 * The toggle stays in SessionHeader, the panel floats over conversation.
 */
export default function SystemInfoPopup() {
  const [open, setOpen] = useState(true)

  return (
    <>
      <SystemInfoToggle open={open} onToggle={() => setOpen(!open)} />
      <SystemInfoPanel open={open} />
    </>
  )
}
