import { type ReactNode } from 'react'
import { useAtom } from 'jotai'
import { artifactWidthAtom } from '../atoms/shellAtom'
import { useDragResize } from '../hooks/useDragResize'

interface AppSpaceProps {
  fullscreen: boolean
  agentPane: ReactNode
  artifactPane: ReactNode
}

export default function AppSpace({ agentPane, artifactPane, fullscreen }: AppSpaceProps) {
  const [artifactWidth, setArtifactWidth] = useAtom(artifactWidthAtom)

  const onArtifactResize = useDragResize(setArtifactWidth, { min: 240, max: 800 }, { invert: true })

  const hasArtifact = artifactPane !== null

  // Fullscreen: artifact fills entire AppSpace, agent pane hidden
  if (fullscreen && artifactPane) {
    return (
      <div className="flex flex-1 min-w-0 overflow-hidden h-full">{artifactPane}</div>
    )
  }

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden h-full">
      {/* Agent pane — hides when fullscreen */}
      <div className="flex flex-col flex-1 min-w-[320px] overflow-hidden border-r border-[var(--app-border)]">
        {agentPane}
      </div>

      {hasArtifact && (
        <>
          <div
            className="w-1.5 cursor-col-resize hover:bg-[var(--app-accent)] active:bg-[var(--app-accent)] transition-colors shrink-0 group relative z-10"
            onMouseDown={onArtifactResize}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
          <div
            className="overflow-hidden shrink-0"
            style={{ width: artifactWidth, minWidth: 240, maxWidth: 800 }}
          >
            {artifactPane}
          </div>
        </>
      )}
    </div>
  )
}
