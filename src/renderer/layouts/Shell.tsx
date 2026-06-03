import { useAtom } from 'jotai'
import { activeActivityAtom } from '../atoms/activityAtom'
import ActivityBar from '../components/ActivityBar/ActivityBar'
import TitleBar from '../components/TitleBar/TitleBar'
import { WorkspaceSidebar, WorkspaceMain } from './WorkspaceRouter'

/**
 * Top-level Shell layout.
 *
 * Three fixed columns:
 *   1. ActivityBar (48px left rail — always present)
 *   2. Sidebar column (TitleBar + activity-specific sidebar content)
 *   3. Main canvas (dispatched by WorkspaceRouter per activity)
 *
 * Each workspace IS free to compose its main canvas however it wants
 * (3-zone, 2-zone, single scrollable view, etc.). The sidebar column
 * is routed separately so TitleBar + traffic lights are always aligned.
 */
export default function Shell() {
  const [activeActivity] = useAtom(activeActivityAtom)

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* 1. Activity Bar — 48px left rail */}
      <ActivityBar />

      {/* 2. Sidebar column — traffic lights region + activity sidebar */}
      <div
        className="flex flex-col flex-shrink-0 border-r border-[var(--app-border)]"
        style={{ width: 'var(--sidebar-width)' }}
      >
        <TitleBar />
        <WorkspaceSidebar activity={activeActivity} />
      </div>

      {/* 3. Main canvas — workspace-controlled layout */}
      <WorkspaceMain activity={activeActivity} />
    </div>
  )
}
