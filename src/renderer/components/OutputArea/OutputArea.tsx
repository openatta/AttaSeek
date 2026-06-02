import { useAtom } from 'jotai'
import {
  outputTabsAtom,
  activeOutputTabAtom,
  outputAreaVisibleAtom
} from '../../atoms/outputTabsAtom'
import { Globe, FolderOpen, Terminal, GitCompare, Maximize2, X } from 'lucide-react'
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

const DEFAULT_TABS = [{ id: 'terminal', type: 'terminal' as const, label: 'Terminal' }]

export default function OutputArea() {
  const [tabs, setTabs] = useAtom(outputTabsAtom)
  const [activeId, setActiveId] = useAtom(activeOutputTabAtom)
  const [visible, setVisible] = useAtom(outputAreaVisibleAtom)

  if (!visible) return null

  // Use default tabs when uninitialized
  const displayTabs = tabs.length > 0 ? tabs : DEFAULT_TABS
  const activeTab =
    tabs.length > 0
      ? tabs.find((t) => t.id === activeId) || DEFAULT_TABS[0]
      : DEFAULT_TABS[0]

  const renderPanel = () => {
    if (!activeTab) return null
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
      className="flex flex-col border-t border-neutral-800 bg-neutral-950"
      style={{ height: '35%', minHeight: '200px' }}
    >
      {/* Tab bar */}
      <div className="flex-shrink-0 flex items-center border-b border-neutral-800 h-[32px]">
        {/* Tab list */}
        <div className="flex items-center flex-1 min-w-0">
          {displayTabs.map((tab) => {
            const config = TAB_CONFIG[tab.type]
            const Icon = config.icon
            const isActive = tab.id === activeId

            return (
              <button
                key={tab.id}
                onClick={() => setActiveId(tab.id)}
                className={`flex items-center gap-1.5 px-3 h-[32px] text-[11px] border-r border-neutral-800
                  transition-colors
                  ${
                    isActive
                      ? 'text-neutral-200 bg-neutral-900 border-b-2 border-b-blue-500'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/50'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="truncate max-w-[80px]">{tab.label}</span>
                <span
                  className="ml-0.5 text-neutral-700 hover:text-neutral-400 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    setTabs((prev) => prev.filter((t) => t.id !== tab.id))
                    if (tab.id === activeId) {
                      const remaining = tabs.filter((t) => t.id !== tab.id)
                      if (remaining.length > 0) setActiveId(remaining[0].id)
                    }
                  }}
                >
                  ×
                </span>
              </button>
            )
          })}
        </div>

        {/* Expand / Hide */}
        <div className="flex items-center flex-shrink-0 mr-1">
          <button
            className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
            title="Expand"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setVisible(false)}
            className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
            title="Hide"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0">{renderPanel()}</div>
    </div>
  )
}
