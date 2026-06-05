import { type ReactNode, useCallback, useRef } from 'react'
import { useAtom } from 'jotai'
import { artifactWidthAtom } from '../atoms/shellAtom'

interface AppSpaceProps {
  fullscreen: boolean
  agentPane: ReactNode
  artifactPane: ReactNode
}

export default function AppSpace({ agentPane, artifactPane, fullscreen }: AppSpaceProps) {
  const [artifactWidth, setArtifactWidth] = useAtom(artifactWidthAtom)
  const draggingRef = useRef(false)

  const onMouseDown = useCallback(() => {
    draggingRef.current = true
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      setArtifactWidth((w) => Math.min(800, Math.max(240, w - e.movementX)))
    }
    const cleanup = () => {
      draggingRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', cleanup)
      document.removeEventListener('pointercancel', cleanup)
      document.removeEventListener('pointerleave', cleanup)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', cleanup)
    document.addEventListener('pointercancel', cleanup)
    document.addEventListener('pointerleave', cleanup)
  }, [setArtifactWidth])

  const hasArtifact = artifactPane !== null

  // Fullscreen: artifact fills entire AppSpace, agent pane hidden
  if (fullscreen && hasArtifact) {
    return <div className="flex flex-1 min-w-0">{artifactPane}</div>
  }

  return (
    <div className="flex flex-1 min-w-0">
      <div className={`flex-1 min-w-0 ${hasArtifact ? 'border-r border-[var(--app-border)]' : ''}`}>
        {agentPane}
      </div>
      {hasArtifact && (
        <div
          onMouseDown={onMouseDown}
          className="w-[5px] -ml-[4px] flex-shrink-0 cursor-col-resize hover:bg-[var(--app-accent)]/30 transition-colors z-10"
        />
      )}
      {hasArtifact && (
        <div className="flex-shrink-0" style={{ width: artifactWidth }}>
          {artifactPane}
        </div>
      )}
    </div>
  )
}


