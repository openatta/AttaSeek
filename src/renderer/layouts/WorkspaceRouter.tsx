import type { Activity } from '../atoms/activityAtom'
import type { ComponentType } from 'react'
import ChatWorkspace from '../workspaces/ChatWorkspace'
import ProjectsWorkspace from '../workspaces/ProjectsWorkspace'
import SettingsWorkspace from '../workspaces/SettingsWorkspace'
import DashboardWorkspace from '../workspaces/DashboardWorkspace'
import SearchWorkspace from '../workspaces/SearchWorkspace'
import AutomationWorkspace from '../workspaces/AutomationWorkspace'
import PluginWorkspace from '../workspaces/PluginWorkspace'

const WORKSPACES: Record<Activity, ComponentType> = {
  home: DashboardWorkspace,
  chat: ChatWorkspace,
  projects: ProjectsWorkspace,
  search: SearchWorkspace,
  automation: AutomationWorkspace,
  plugin: PluginWorkspace,
  settings: SettingsWorkspace
}

interface WorkspaceRouterProps {
  activity: Activity
}

export default function WorkspaceRouter({ activity }: WorkspaceRouterProps) {
  const Workspace = WORKSPACES[activity] || ChatWorkspace
  return <Workspace />
}
