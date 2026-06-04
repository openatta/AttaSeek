import Conversation from '../components/Conversation/Conversation'

/**
 * Chat workspace — Conversation is the main content.
 * Sidebar (ChatsSidebar) → Shell's SidebarSlot.
 * ArtifactPane → Shell's AppSpace (right side).
 */
export default function ChatWorkspace() {
  return <Conversation />
}
