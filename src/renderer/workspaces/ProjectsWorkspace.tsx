import WorkspaceLayout from '../layouts/WorkspaceLayout'
import Conversation from '../components/Conversation/Conversation'
import OutputArea from '../components/OutputArea/OutputArea'

/**
 * Projects workspace — main canvas is 2-zone:
 *   [Main: conversation]  [Right: output area]
 * Left sidebar (file tree) is handled by WorkspaceSidebar.
 */
export default function ProjectsWorkspace() {
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
