import { useCallback, useRef, type ReactNode } from 'react'

interface SlotProps {
  children: ReactNode
  width?: number
  onResize?: (delta: number) => void
}

function Left({ children, width = 260, onResize }: SlotProps) {
  return (
    <div className="flex-shrink-0 border-r border-[var(--app-border)] relative flex flex-col" style={{ width }}>
      {children}
      <ResizeHandleEdge side="right" onResize={onResize || (() => {})} />
    </div>
  )
}

function Main({ children }: { children: ReactNode }) {
  return <div className="flex flex-col flex-1 min-w-0 min-h-0">{children}</div>
}

function Right({ children, width = 400, onResize }: SlotProps) {
  return (
    <div className="flex-shrink-0 border-l border-[var(--app-border)] relative flex flex-col" style={{ width }}>
      <ResizeHandleEdge side="left" onResize={onResize || (() => {})} />
      {children}
    </div>
  )
}

function ResizeHandleEdge({ side, onResize }: { side: 'left' | 'right'; onResize: (delta: number) => void }) {
  const dragging = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragging.current = true

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const sign = side === 'right' ? 1 : -1
      onResize(sign * ev.movementX)
    }

    const onMouseUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [side, onResize])

  return (
    <div
      className={`absolute top-0 bottom-0 w-1 z-10 cursor-col-resize transition-colors hover:bg-[var(--app-accent)]/40 ${side === 'right' ? '-right-0.5' : '-left-0.5'}`}
      onMouseDown={onMouseDown}
    />
  )
}

const WorkspaceLayout = { Left, Main, Right }
export default WorkspaceLayout
