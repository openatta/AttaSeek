import type { ReactNode } from 'react'

/**
 * Optional shared slot primitives for workspace composition.
 * Workspaces are NOT forced to use these — each workspace freely
 * composes its own layout. These are convenience wrappers with
 * sensible width constraints for the common 3-zone pattern.
 */

function Left({ children, width = '260px' }: { children: ReactNode; width?: string }) {
  return (
    <div
      className="flex-shrink-0 border-r border-[var(--app-border)] overflow-y-auto"
      style={{ width, minWidth: '200px', maxWidth: '400px' }}
    >
      {children}
    </div>
  )
}

function Main({ children }: { children: ReactNode }) {
  return <div className="flex flex-col flex-1 min-w-0 min-h-0">{children}</div>
}

function Right({ children, width = '400px' }: { children: ReactNode; width?: string }) {
  return (
    <div
      className="flex-shrink-0 border-l border-[var(--app-border)]"
      style={{ width, minWidth: '280px', maxWidth: '600px' }}
    >
      {children}
    </div>
  )
}

const WorkspaceLayout = { Left, Main, Right }
export default WorkspaceLayout
