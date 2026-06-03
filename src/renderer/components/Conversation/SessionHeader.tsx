import { useAtom } from 'jotai'
import { outputAreaVisibleAtom } from '../../atoms/outputTabsAtom'
import { PanelLeftClose } from 'lucide-react'
import AppLauncher from './AppLauncher'
import SystemInfoPopup from './SystemInfoPopup'

export default function SessionHeader() {
  const [outputVisible, setOutputVisible] = useAtom(outputAreaVisibleAtom)

  return (
    <div
      className="flex-shrink-0 h-[40px] flex items-center gap-3 px-4 border-b border-[var(--app-border)] bg-[var(--app-bg-elevated)]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left — editable session title */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-[var(--app-text)] truncate">New Session</span>
      </div>

      {/* Center — spacer */}
      <div className="flex-1" />

      {/* Right — action buttons (fixed-width container to prevent layout shift) */}
      <div
        className="flex items-center gap-0.5 flex-shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* App launcher dropdown */}
        <AppLauncher />

        {/* System info popup toggle */}
        <SystemInfoPopup />

        {/* Toggle output area — hidden (removed from layout) when output is visible */}
        {!outputVisible && (
          <button
            onClick={() => setOutputVisible(true)}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
            title="Show output area"
            aria-label="Show output area"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
