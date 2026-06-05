import type { Activity } from '../atoms/activityAtom'
import type { ComponentType } from 'react'
import { getActivityConfig } from '../registries/activityRegistry'
import ChatWorkspace from '../workspaces/ChatWorkspace'
import ProjectsWorkspace from '../workspaces/ProjectsWorkspace'
import SettingsWorkspace from '../workspaces/SettingsWorkspace'
import DashboardWorkspace from '../workspaces/DashboardWorkspace'
import SearchWorkspace from '../workspaces/SearchWorkspace'
import AutomationWorkspace from '../workspaces/AutomationWorkspace'
import PluginWorkspace from '../workspaces/PluginWorkspace'

/** Built-in fallback — used before registries initialize or when registry has no entry */
const FALLBACK: Record<Activity, ComponentType> = {
  home: DashboardWorkspace,
  chat: ChatWorkspace,
  projects: ProjectsWorkspace,
  search: SearchWorkspace,
  automation: AutomationWorkspace,
  plugin: PluginWorkspace,
  settings: SettingsWorkspace,
}

interface WorkspaceRouterProps {
  activity: Activity
}

export default function WorkspaceRouter({ activity }: WorkspaceRouterProps) {
  // Registry-first: plugins can register activities dynamically
  const config = getActivityConfig(activity)
  const Workspace = config?.workspaceComponent || FALLBACK[activity] || ChatWorkspace
  return <Workspace />
}
