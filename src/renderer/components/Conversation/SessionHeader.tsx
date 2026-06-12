import { useAtom, useAtomValue } from 'jotai'
import { outputAreaVisibleAtom } from '../../atoms/outputTabsAtom'
import { sessionTitleAtom, currentSessionIdAtom } from '../../atoms/sessionAtom'
import { PanelLeftClose, ExternalLink } from 'lucide-react'
import { getApi } from '../../utils/api'
import AppLauncher from './AppLauncher'
import SystemInfoPopup from './SystemInfoPopup'

export default function SessionHeader() {
  const [outputVisible, setOutputVisible] = useAtom(outputAreaVisibleAtom)
  const title = useAtomValue(sessionTitleAtom)
  const sessionId = useAtomValue(currentSessionIdAtom)

  const openSideChat = () => {
    const api = getApi()
    void api.window.openSideChat(sessionId)
  }

  return (
    <div
      className="flex-shrink-0 h-[40px] flex items-center gap-3 px-4 border-b border-[var(--app-border)] bg-[var(--app-bg-elevated)]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-[var(--app-text)] truncate">{title}</span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-0.5 flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <AppLauncher />
        <SystemInfoPopup />
        <button
          onClick={openSideChat}
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
          title="Open in new window"
          aria-label="Open in new window"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
        {!outputVisible && (
          <button onClick={() => setOutputVisible(true)} className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors" title="Show output area" aria-label="Show output area">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
