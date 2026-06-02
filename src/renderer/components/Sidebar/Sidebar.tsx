import type { Activity } from '../../atoms/activityAtom'

type SidebarProps = {
  activity: Activity
}

const PLACEHOLDER: Record<Activity, string> = {
  home: 'Dashboard — coming soon',
  chat: 'Sessions — coming soon',
  projects: 'Projects — coming soon',
  search: 'Search — coming soon',
  automation: 'Automation — coming soon',
  plugin: 'Plugins — coming soon',
  settings: 'Settings — coming soon'
}

export default function Sidebar({ activity }: SidebarProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      {/* Activity header */}
      <div className="px-4 py-3 border-b border-neutral-800/50">
        <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          {activity}
        </h2>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-neutral-600 text-center">
          {PLACEHOLDER[activity]}
        </p>
      </div>
    </div>
  )
}
