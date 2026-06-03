import type { ReactNode } from 'react'

/**
 * Shared slot primitives for workspace composition.
 * Each workspace freely composes Left/Main/Right as needed.
 */

interface SlotProps {
  children: ReactNode
  width?: number
  minWidth?: number
  maxWidth?: number
  onResize?: (delta: number) => void
  showResizeHandle?: boolean
}

function Left({
  children,
  width = 260,
  minWidth = 200,
  maxWidth = 400,
  showResizeHandle = true
}: SlotProps) {
  return (
    <div className="flex-shrink-0 border-r border-[var(--app-border)] relative flex flex-col" style={{ width }}>
      {children}
      {showResizeHandle && (
        <ResizeHandleEdge side="right" />
      )}
    </div>
  )
}

function Main({ children }: { children: ReactNode }) {
  return <div className="flex flex-col flex-1 min-w-0 min-h-0">{children}</div>
}

function Right({
  children,
  width = 400,
  minWidth = 280,
  maxWidth = 600,
  showResizeHandle = true
}: SlotProps) {
  return (
    <div className="flex-shrink-0 border-l border-[var(--app-border)] relative flex flex-col" style={{ width }}>
      {children}
      {showResizeHandle && (
        <ResizeHandleEdge side="left" />
      )}
    </div>
  )
}

/**
 * Visual drag handle edge — 4px wide transparent strip that lights up on hover.
 * The actual drag logic is wired by the parent workspace via onResize.
 */
function ResizeHandleEdge({ side }: { side: 'left' | 'right' }) {
  return (
    <div
      className={`absolute top-0 bottom-0 w-1 z-10 cursor-col-resize transition-colors hover:bg-[var(--app-accent)]/40 ${side === 'right' ? '-right-0.5' : '-left-0.5'}`}
    />
  )
}

const WorkspaceLayout = { Left, Main, Right }
export default WorkspaceLayout
