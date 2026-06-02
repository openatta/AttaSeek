import type { Activity } from '../../atoms/activityAtom'
import ChatsList from './ChatsList'
import SettingsSidebar from '../Settings/SettingsSidebar'

type SidebarProps = { activity: Activity }

const PLACEHOLDER: Record<string, string> = {
  home: 'Dashboard',
  chat: 'Sessions',
  search: 'Search',
  automation: 'Automation',
  plugin: 'Plugins',
  projects: 'Projects'
}

export default function Sidebar({ activity }: SidebarProps) {
  const renderContent = () => {
    switch (activity) {
      case 'chats':
        return <ChatsList />
      case 'settings':
        return <SettingsSidebar />
      default:
        return (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-sm text-neutral-600 text-center">
              {PLACEHOLDER[activity] || activity} — coming soon
            </p>
          </div>
        )
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      {/* Activity header — 40px, no border */}
      <div className="h-[40px] flex items-center px-4">
        <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          {activity === 'chats' ? 'Chats' : activity === 'settings' ? 'Settings' : activity}
        </h2>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  )
}
