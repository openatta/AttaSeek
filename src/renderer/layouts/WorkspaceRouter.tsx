import type { Activity } from '../atoms/activityAtom'
import type { ComponentType, ReactNode } from 'react'
import ChatsList from '../components/Sidebar/ChatsList'
import SettingsSidebar from '../components/Settings/SettingsSidebar'
import ChatWorkspace from '../workspaces/ChatWorkspace'
import ProjectsWorkspace from '../workspaces/ProjectsWorkspace'
import SettingsWorkspace from '../workspaces/SettingsWorkspace'
import DashboardWorkspace from '../workspaces/DashboardWorkspace'
import SearchWorkspace from '../workspaces/SearchWorkspace'
import AutomationWorkspace from '../workspaces/AutomationWorkspace'
import PluginWorkspace from '../workspaces/PluginWorkspace'

/* ── Main canvas dispatch ─────────────────────────────────────── */

const WORKSPACES: Record<Activity, ComponentType> = {
  home: DashboardWorkspace,
  chat: ChatWorkspace,
  chats: ChatWorkspace,
  projects: ProjectsWorkspace,
  search: SearchWorkspace,
  automation: AutomationWorkspace,
  plugin: PluginWorkspace,
  settings: SettingsWorkspace
}

export function WorkspaceMain({ activity }: { activity: Activity }) {
  const Workspace = WORKSPACES[activity] || ChatWorkspace
  return <Workspace />
}

/* ── Sidebar content dispatch ─────────────────────────────────── */

function SidebarWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      {children}
    </div>
  )
}

const PLACEHOLDER: Record<string, string> = {
  home: 'Dashboard',
  chat: 'Sessions',
  search: 'Search',
  automation: 'Automation',
  plugin: 'Plugins',
  projects: 'Projects'
}

export function WorkspaceSidebar({ activity }: { activity: Activity }) {
  switch (activity) {
    case 'chats':
    case 'chat':
      return (
        <SidebarWrapper>
          <div className="h-[40px] flex items-center px-4">
            <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
              Chats
            </h2>
          </div>
          <ChatsList />
        </SidebarWrapper>
      )
    case 'settings':
      return (
        <SidebarWrapper>
          <div className="h-[40px] flex items-center px-4">
            <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
              Settings
            </h2>
          </div>
          <SettingsSidebar />
        </SidebarWrapper>
      )
    default:
      return (
        <SidebarWrapper>
          <div className="h-[40px] flex items-center px-4">
            <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
              {PLACEHOLDER[activity] || activity}
            </h2>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-sm text-[var(--app-text-dim)] text-center">
              {PLACEHOLDER[activity] || activity} — coming soon
            </p>
          </div>
        </SidebarWrapper>
      )
  }
}
