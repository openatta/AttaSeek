import Conversation from '../components/Conversation/Conversation'

/**
 * Projects workspace — Conversation layout, same as Chat.
 * Sidebar (ProjectsSidebar) → Shell's SidebarSlot.
 * ArtifactPane → Shell's AppSpace (right side).
 * Main content = Conversation (AgentPane).
 */
export default function ProjectsWorkspace() {
  return <Conversation />
}
