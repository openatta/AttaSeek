import { useState } from 'react'
import { useAtom } from 'jotai'
import { activeActivityAtom, type Activity } from '../../atoms/activityAtom'
import { Bug, Command, SquarePen, Search, Zap, Plug2, FolderGit2, Settings } from 'lucide-react'
import LogViewer from './LogViewer'

type NavItem = { id: Activity; icon: React.ComponentType<{ className?: string }>; label: string }

const TOP_ITEMS: NavItem[] = [
  { id: 'home', icon: Command, label: 'Home' },
  { id: 'chat', icon: SquarePen, label: 'New Session' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'automation', icon: Zap, label: 'Automation' },
  { id: 'plugin', icon: Plug2, label: 'Plugins' },
  { id: 'projects', icon: FolderGit2, label: 'Projects' },
]

export default function ActivityBar() {
  const [active, setActive] = useAtom(activeActivityAtom)
  const [showLogs, setShowLogs] = useState(false)

  return (
    <>
    <div className="flex flex-col items-center flex-shrink-0 h-full border-r border-[var(--app-border)] select-none bg-[var(--app-bg-inset)]"
      style={{ width: 'var(--activity-bar-width)' }}>
      <div className="h-[40px] w-full" />
      <div className="flex flex-col items-center gap-1 pt-1">
        {TOP_ITEMS.map(({ id, icon: Icon, label }) => {
          const isActive = active === id
          return (
            <button key={id} onClick={() => setActive(id)}
              className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors duration-150 ${isActive ? 'text-blue-400 bg-blue-400/10' : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]'}`}
              title={label} aria-label={label}>
              <Icon className="w-5 h-5" />
            </button>
          )
        })}
      </div>
      <div className="flex-1" />
      <div className="mb-1">
        <button onClick={() => setShowLogs(!showLogs)}
          className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors duration-150 ${showLogs ? 'text-yellow-400 bg-yellow-400/10' : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]'}`}
          title="Debug Logs" aria-label="Debug Logs">
          <Bug className="w-5 h-5" />
        </button>
      </div>
      <div className="mb-3">
        <button onClick={() => setActive('settings')}
          className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors duration-150 ${active === 'settings' ? 'text-blue-400 bg-blue-400/10' : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]'}`}
          title="Settings" aria-label="Settings">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
    {showLogs && <LogViewer onClose={() => setShowLogs(false)} />}
    </>
  )
}
