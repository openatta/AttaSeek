import { useAtom } from 'jotai'
import { activeActivityAtom, type Activity } from '../../atoms/activityAtom'
import {
  Command,
  SquarePen,
  Search,
  Zap,
  Plug2,
  FolderGit2,
  Settings
} from 'lucide-react'

type NavItem = {
  id: Activity
  icon: React.ComponentType<{ className?: string }>
  label: string
}

const TOP_ITEMS: NavItem[] = [
  { id: 'home', icon: Command, label: 'Home' },
  { id: 'chat', icon: SquarePen, label: 'New Session' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'automation', icon: Zap, label: 'Automation' },
  { id: 'plugin', icon: Plug2, label: 'Plugins' },
  { id: 'projects', icon: FolderGit2, label: 'Projects' }
]

export default function ActivityBar() {
  const [active, setActive] = useAtom(activeActivityAtom)

  return (
    <div
      className="flex flex-col items-center flex-shrink-0 h-full border-r border-[var(--app-border)] select-none bg-[var(--app-bg-inset)]"
      style={{ width: 'var(--activity-bar-width)' }}
    >
      {/* Title bar region — aligns with workspace header (traffic lights on macOS) */}
      <div className="h-[40px] w-full" />

      {/* Primary nav items */}
      <div className="flex flex-col items-center gap-1 pt-1">
        {TOP_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors duration-150
                ${
                  isActive
                    ? 'text-blue-400 bg-blue-400/10'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]'
                }`}
              title={item.label}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}
      </div>

      {/* Natural gap replaces explicit separator line */}

      {/* Plugin slots (placeholder) */}
      <div className="flex-1" />

      {/* Settings — bottom aligned */}
      <div className="mb-3">
        <button
          onClick={() => setActive('settings')}
          className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors duration-150
            ${
              active === 'settings'
                ? 'text-blue-400 bg-blue-400/10'
                : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]'
            }`}
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
