import { useAtom } from 'jotai'
import {
  outputTabsAtom,
  activeOutputTabAtom,
  outputAreaVisibleAtom
} from '../../atoms/outputTabsAtom'
import { outputFullscreenAtom } from '../../atoms/outputFullscreenAtom'
import { Globe, FolderOpen, Terminal, GitCompare, Maximize2, PanelRightClose } from 'lucide-react'
import BrowserPanel from './BrowserPanel'
import FilesPanel from './FilesPanel'
import TerminalPanel from './TerminalPanel'
import ReviewPanel from './ReviewPanel'

const TAB_CONFIG = {
  browser: { icon: Globe, label: 'Browser' },
  files: { icon: FolderOpen, label: 'Files' },
  terminal: { icon: Terminal, label: 'Terminal' },
  review: { icon: GitCompare, label: 'Review' }
}

export default function OutputArea() {
  const [tabs, setTabs] = useAtom(outputTabsAtom)
  const [activeId, setActiveId] = useAtom(activeOutputTabAtom)
  const [visible, setVisible] = useAtom(outputAreaVisibleAtom)
  const [fullscreen, setFullscreen] = useAtom(outputFullscreenAtom)

  if (!visible) return null

  const displayTabs = tabs
  const activeTab = tabs.length > 0 ? tabs.find((t) => t.id === activeId) || tabs[0] : null

  const renderPanel = () => {
    if (!activeTab) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-xs text-[var(--app-text-dim)]">No tabs open</p>
        </div>
      )
    }
    switch (activeTab.type) {
      case 'browser':
        return <BrowserPanel />
      case 'files':
        return <FilesPanel />
      case 'terminal':
        return <TerminalPanel />
      case 'review':
        return <ReviewPanel />
    }
  }

  return (
    <div
      className="flex flex-col flex-shrink-0 border-l border-[var(--app-border)] bg-[var(--app-bg)]"
      style={{ width: fullscreen ? undefined : '400px', minWidth: fullscreen ? undefined : '280px', maxWidth: fullscreen ? undefined : '600px' }}
    >
      {/* Title bar — 40px, draggable */}
      <div
        className="flex-shrink-0 flex items-center border-b border-[var(--app-border)] h-[40px]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Tab list — left side */}
        <div className="flex items-center flex-1 min-w-0 overflow-x-auto">
          {displayTabs.map((tab) => {
            const config = TAB_CONFIG[tab.type]
            const Icon = config?.icon
            const isActive = tab.id === activeId

            return (
              <button
                key={tab.id}
                onClick={() => setActiveId(tab.id)}
                className={`flex items-center gap-1.5 px-3 h-[40px] text-[11px] border-r border-[var(--app-border)]
                  transition-colors flex-shrink-0
                  ${
                    isActive
                      ? 'text-[var(--app-text)] bg-[var(--app-bg-inset)] border-b-2 border-b-blue-500'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]'
                  }`}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span className="truncate max-w-[80px]">{tab.label}</span>
                <span
                  className="ml-0.5 text-[var(--app-text-dim)] hover:text-[var(--app-text-secondary)] cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    const remaining = tabs.filter((t) => t.id !== tab.id)
                    setTabs(remaining)
                    if (tab.id === activeId && remaining.length > 0) {
                      setActiveId(remaining[0].id)
                    }
                  }}
                >
                  ×
                </span>
              </button>
            )
          })}
        </div>

        {/* Right buttons: fullscreen toggle + hide panel */}
        <div className="flex items-center flex-shrink-0 mr-1">
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
            title={fullscreen ? 'Restore' : 'Fullscreen'}
            aria-label={fullscreen ? 'Restore' : 'Fullscreen'}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setVisible(false)}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
            title="Hide panel"
            aria-label="Hide panel"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <PanelRightClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0">{renderPanel()}</div>
    </div>
  )
}
