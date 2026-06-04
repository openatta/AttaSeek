/**
 * AgentPane — the core AI interaction panel, defaulting to Conversation.
 *
 * AgentPane consumes SessionEvent stream and renders:
 *  - Conversation (message flow)
 *  - InlineArtifactPreview (lightweight inline renderers)
 *  - ToolCallCard (tool execution summary)
 *  - PermissionInline (permission confirmation)
 *  - AgentStatus (task state display)
 *  - Composer (user input)
 *
 * It does NOT execute tools or call LLMs directly.
 */

import Conversation from '../components/Conversation/Conversation'

interface AgentPaneProps {
  /** Override for future plugin-provided agent UI */
  children?: React.ReactNode
}

export default function AgentPane({ children }: AgentPaneProps) {
  if (children) {
    return (
      <div className="flex flex-col h-full bg-[var(--app-bg-primary)]">
        {children}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[var(--app-bg-primary)]">
      <Conversation />
    </div>
  )
}
