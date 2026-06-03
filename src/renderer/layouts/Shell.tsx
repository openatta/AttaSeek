import { useAtom } from 'jotai'
import { activeActivityAtom } from '../atoms/activityAtom'
import ActivityBar from '../components/ActivityBar/ActivityBar'
import WorkspaceRouter from './WorkspaceRouter'

/**
 * Top-level Shell layout.
 *
 * Two columns:
 *   1. ActivityBar (48px left rail — always present)
 *   2. Workspace area (flex-1) — dispatched by WorkspaceRouter per activity
 *
 * Each workspace freely composes its own zones — left sidebar,
 * main conversation/content, right output area, or none at all.
 * The shell is a thin frame; workspaces own their layout.
 */
export default function Shell() {
  const [activeActivity] = useAtom(activeActivityAtom)

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* 1. Activity Bar — 48px left rail */}
      <ActivityBar />

      {/* 2. Workspace area — workspace-controlled layout */}
      <div className="flex flex-1 min-w-0">
        <WorkspaceRouter activity={activeActivity} />
      </div>
    </div>
  )
}
