import { useState } from 'react'
import WorkspaceLayout from '../layouts/WorkspaceLayout'
import Conversation from '../components/Conversation/Conversation'
import OutputArea from '../components/OutputArea/OutputArea'

/**
 * Projects workspace — 3-zone:
 *   [Left: file tree]  [Main: conversation]  [Right: output area]
 */
export default function ProjectsWorkspace() {
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [outputWidth, setOutputWidth] = useState(400)

  return (
    <div className="flex flex-1 min-w-0">
      <WorkspaceLayout.Left
        width={sidebarWidth}
        onResize={(d) => setSidebarWidth((w) => Math.min(400, Math.max(200, w + d)))}
      >
        <div
          className="flex-shrink-0 h-[40px] flex items-center px-4"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
            PROJECTS
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-[var(--app-text-dim)]">File tree — coming soon</p>
        </div>
      </WorkspaceLayout.Left>
      <WorkspaceLayout.Main>
        <Conversation />
      </WorkspaceLayout.Main>
      <WorkspaceLayout.Right
        width={outputWidth}
        onResize={(d) => setOutputWidth((w) => Math.min(600, Math.max(280, w + d)))}
      >
        <OutputArea />
      </WorkspaceLayout.Right>
    </div>
  )
}
