import { useAtom } from 'jotai'
import { activeActivityAtom, type Activity } from '../../atoms/activityAtom'
import {
  Command,
  SquarePen,
  MessageSquareText,
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
  { id: 'chats', icon: MessageSquareText, label: 'Chats' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'automation', icon: Zap, label: 'Automation' },
  { id: 'plugin', icon: Plug2, label: 'Plugins' },
  { id: 'projects', icon: FolderGit2, label: 'Projects' }
]

export default function ActivityBar() {
  const [active, setActive] = useAtom(activeActivityAtom)

  return (
    <div
      className="flex flex-col items-center flex-shrink-0 h-full border-r border-neutral-800 select-none"
      style={{ width: 'var(--activity-bar-width)' }}
    >
      {/* Traffic lights spacer (macOS) */}
      <div className="traffic-lights-spacer w-full" />

      {/* Primary nav items */}
      <div className="flex flex-col items-center gap-1 pt-2">
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
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60'
                }`}
              title={item.label}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}
      </div>

      {/* Separator */}
      <div className="w-6 h-px bg-neutral-700 my-3" />

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
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60'
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
