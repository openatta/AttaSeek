import type { Activity } from '../atoms/activityAtom'
import { getActivityConfig } from '../registries/activityRegistry'
import ChatWorkspace from '../workspaces/ChatWorkspace'

interface WorkspaceRouterProps {
  activity: Activity
}

export default function WorkspaceRouter({ activity }: WorkspaceRouterProps) {
  // Registry-first: plugins can register activities dynamically.
  // Registries auto-init before first render (init.ts), so the registry
  // always has the built-in entry. ChatWorkspace is the safe fallback.
  const config = getActivityConfig(activity)
  const Workspace = config?.workspaceComponent || ChatWorkspace
  return <Workspace />
}
