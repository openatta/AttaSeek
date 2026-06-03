import WorkspaceLayout from '../layouts/WorkspaceLayout'
import Conversation from '../components/Conversation/Conversation'
import OutputArea from '../components/OutputArea/OutputArea'

/**
 * Chat workspace — main canvas is 2-zone:
 *   [Main: conversation]  [Right: output area]
 * The left sidebar (chat list) is handled by WorkspaceSidebar in Shell.
 */
export default function ChatWorkspace() {
  return (
    <div className="flex flex-1 min-w-0">
      <WorkspaceLayout.Main>
        <Conversation />
      </WorkspaceLayout.Main>
      <WorkspaceLayout.Right>
        <OutputArea />
      </WorkspaceLayout.Right>
    </div>
  )
}
