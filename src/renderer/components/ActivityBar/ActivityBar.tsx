import { useAtom } from 'jotai'
import { activeActivityAtom, type Activity } from '../../atoms/activityAtom'

type NavItem = {
  id: Activity
  icon: string
  label: string
}

const TOP_ITEMS: NavItem[] = [
  { id: 'home', icon: '⌂', label: 'Home' },
  { id: 'chat', icon: '+', label: 'New Session' },
  { id: 'search', icon: '⌕', label: 'Search' },
  { id: 'automation', icon: '⚡', label: 'Automation' },
  { id: 'plugin', icon: '⬡', label: 'Plugins' },
  { id: 'projects', icon: '⊞', label: 'Projects' }
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
        {TOP_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className={`w-9 h-9 flex items-center justify-center rounded-md text-lg transition-colors duration-150
              ${
                active === item.id
                  ? 'text-blue-400 bg-blue-400/10'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60'
              }`}
            title={item.label}
            aria-label={item.label}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-6 h-px bg-neutral-700 my-3" />

      {/* Plugin slots (placeholder) */}
      <div className="flex-1" />

      {/* Settings — bottom aligned */}
      <div className="mb-3">
        <button
          onClick={() => setActive('settings')}
          className={`w-9 h-9 flex items-center justify-center rounded-md text-lg transition-colors duration-150
            ${
              active === 'settings'
                ? 'text-blue-400 bg-blue-400/10'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60'
            }`}
          title="Settings"
          aria-label="Settings"
        >
          ⚙
        </button>
      </div>
    </div>
  )
}
