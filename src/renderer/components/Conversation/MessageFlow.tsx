import { useAtomValue } from 'jotai'
import { sessionEventsAtom, currentSessionIdAtom, agentTasksAtom } from '../../atoms/sessionAtom'
import AgentStatusBar from './AgentStatusBar'
import type { SessionEvent } from '../../core/types/SessionEvent'
import UserMessageEvent from './events/UserMessageEvent'
import AgentMessageEvent from './events/AgentMessageEvent'
import PlanCreatedEvent from './events/PlanCreatedEvent'
import ToolCallStartedEvent from './events/ToolCallStartedEvent'
import ToolCallFinishedEvent from './events/ToolCallFinishedEvent'
import ArtifactCreatedEvent from './events/ArtifactCreatedEvent'
import TaskCompletedEvent from './events/TaskCompletedEvent'
import TaskFailedEvent from './events/TaskFailedEvent'

/**
 * Scrollable message flow area driven by session events.
 * Renders user messages, agent messages, tool call cards,
 * plan cards, permission prompts, and artifact references.
 */
export default function MessageFlow() {
  const events = useAtomValue(sessionEventsAtom)
  const tasks = useAtomValue(agentTasksAtom)
  const sessionId = useAtomValue(currentSessionIdAtom)

  // Filter events for current session
  const sessionEvents = events.filter((e) => e.sessionId === sessionId)

  if (sessionEvents.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto min-h-0">
        <AgentStatusBar />

        <div className="flex flex-col items-center justify-center h-full px-6 pb-20">
          <div className="w-16 h-16 rounded-2xl bg-[var(--app-bg-hover)] flex items-center justify-center mb-4">
            <span className="text-2xl text-[var(--app-text-dim)]">◈</span>
          </div>
          <h3 className="text-sm font-medium text-[var(--app-text-secondary)] mb-1">
            AttaSeek Agent Workbench
          </h3>
          <p className="text-xs text-[var(--app-text-dim)] text-center max-w-xs">
            Type a message below to start. The agent will plan, execute tools, and generate artifacts.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <AgentStatusBar />
      <div className="px-4 py-2 space-y-2 max-w-3xl mx-auto">
        {sessionEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
      {/* Scroll anchor */}
      <div className="h-4" />
    </div>
  )
}

function EventCard({ event }: { event: SessionEvent }) {
  switch (event.type) {
    case 'UserMessage':
      return <UserMessageEvent payload={event.payload as Parameters<typeof UserMessageEvent>[0]['payload']} />
    case 'AgentMessage':
      return <AgentMessageEvent payload={event.payload as Parameters<typeof AgentMessageEvent>[0]['payload']} />
    case 'PlanCreated':
      return <PlanCreatedEvent payload={event.payload as Parameters<typeof PlanCreatedEvent>[0]['payload']} />
    case 'ToolCallStarted':
      return <ToolCallStartedEvent payload={event.payload as Parameters<typeof ToolCallStartedEvent>[0]['payload']} />
    case 'ToolCallFinished':
      return <ToolCallFinishedEvent payload={event.payload as Parameters<typeof ToolCallFinishedEvent>[0]['payload']} />
    case 'ArtifactCreated':
      return <ArtifactCreatedEvent payload={event.payload as Parameters<typeof ArtifactCreatedEvent>[0]['payload']} />
    case 'TaskCompleted':
      return <TaskCompletedEvent payload={event.payload as Parameters<typeof TaskCompletedEvent>[0]['payload']} />
    case 'TaskFailed':
      return <TaskFailedEvent payload={event.payload as Parameters<typeof TaskFailedEvent>[0]['payload']} />
    default:
      return null
  }
}
