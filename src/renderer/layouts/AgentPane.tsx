/**
 * AgentPane — the core AI interaction panel.
 *
 * Renders Conversation (message flow + composer) as the primary agent UI.
 * It does NOT execute tools or call LLMs directly.
 */

import Conversation from '../components/Conversation/Conversation'

export default function AgentPane() {
  return (
    <div className="flex flex-col h-full bg-[var(--app-bg-primary)]">
      <Conversation />
    </div>
  )
}
