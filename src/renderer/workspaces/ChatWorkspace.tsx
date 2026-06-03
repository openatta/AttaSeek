import { useState } from 'react'
import { useAtom } from 'jotai'
import WorkspaceLayout from '../layouts/WorkspaceLayout'
import Conversation from '../components/Conversation/Conversation'
import OutputArea from '../components/OutputArea/OutputArea'
import ChatsSidebar from './ChatsSidebar'
import { outputFullscreenAtom } from '../atoms/outputFullscreenAtom'
import { outputAreaVisibleAtom } from '../atoms/outputTabsAtom'

/**
 * Chat workspace — 3-zone (or fullscreen output):
 *   [Left: chats sidebar]  [Main: conversation]  [Right: output area]
 *
 * When output is fullscreen, it replaces Main+Right entirely.
 */
export default function ChatWorkspace() {
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [outputWidth, setOutputWidth] = useState(400)
  const [fullscreen] = useAtom(outputFullscreenAtom)
  const [outputVisible] = useAtom(outputAreaVisibleAtom)

  return (
    <div className="flex flex-1 min-w-0">
      <WorkspaceLayout.Left
        width={sidebarWidth}
        onResize={(d) => setSidebarWidth((w) => Math.min(400, Math.max(200, w + d)))}
      >
        <ChatsSidebar />
      </WorkspaceLayout.Left>

      {fullscreen && outputVisible ? (
        /* Output fullscreen — occupies Main + Right space */
        <div className="flex-1 min-w-0">
          <OutputArea />
        </div>
      ) : (
        <>
          <WorkspaceLayout.Main>
            <Conversation />
          </WorkspaceLayout.Main>
          <WorkspaceLayout.Right
            width={outputWidth}
            onResize={(d) => setOutputWidth((w) => Math.min(600, Math.max(280, w + d)))}
          >
            <OutputArea />
          </WorkspaceLayout.Right>
        </>
      )}
    </div>
  )
}
