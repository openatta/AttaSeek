import AgentStatusBar from './AgentStatusBar'

/**
 * Scrollable message flow area.
 * Shows the conversation history — user messages, agent responses,
 * tool call cards, permission prompts, and inline diffs.
 */
export default function MessageFlow() {
  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <AgentStatusBar />

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center h-full px-6 pb-20">
        <div className="w-16 h-16 rounded-2xl bg-[var(--app-bg-hover)] flex items-center justify-center mb-4">
          <span className="text-2xl text-[var(--app-text-dim)]">◈</span>
        </div>
        <h3 className="text-sm font-medium text-[var(--app-text-secondary)] mb-1">
          AttaSeek Agent
        </h3>
        <p className="text-xs text-[var(--app-text-dim)] text-center max-w-xs">
          Start a conversation by typing a message below.
          Ask the agent to read code, write patches, run commands, or review changes.
        </p>
      </div>
    </div>
  )
}
