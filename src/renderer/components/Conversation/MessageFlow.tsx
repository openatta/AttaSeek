import { useRef, useState, useEffect, useMemo, useCallback, memo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { sessionEventsAtom, currentSessionIdAtom, agentTasksAtom, streamingBuffersAtom } from '../../atoms/sessionAtom'
import { editTextAtom } from '../../atoms/composerAtom'

import type { SessionEvent } from '../../core/types/SessionEvent'
import UserMessageEvent from './events/UserMessageEvent'
import AgentMessageEvent from './events/AgentMessageEvent'
import PlanCreatedEvent from './events/PlanCreatedEvent'
import ToolCallStartedEvent from './events/ToolCallStartedEvent'
import ToolCallFinishedEvent from './events/ToolCallFinishedEvent'
import ArtifactCreatedEvent from './events/ArtifactCreatedEvent'
import TaskCompletedEvent from './events/TaskCompletedEvent'
import TaskFailedEvent from './events/TaskFailedEvent'
import PermissionRequestedEvent from './events/PermissionRequestedEvent'
import NoModelPrompt from './NoModelPrompt'
import { ArrowDown } from 'lucide-react'

// Shared design tokens: max-w-[48rem] content width (also in Composer.tsx:137)
const SCROLL_THRESHOLD_PX = 150

export default function MessageFlow() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const events = useAtomValue(sessionEventsAtom)
  const sessionId = useAtomValue(currentSessionIdAtom)
  const streamingBuffers = useAtomValue(streamingBuffersAtom)
  const setEditText = useSetAtom(editTextAtom)

  const { sessionEvents, streamingMessageId, lastAgentIdx, streamTotalLen } = useMemo(() => {
    const filtered = events.filter((e) => e.sessionId === sessionId)
    const keys = Object.keys(streamingBuffers).filter((k) => streamingBuffers[k])
    const msgId = keys.length > 0 ? keys[keys.length - 1] : undefined
    let agentIdx = -1
    for (let i = filtered.length - 1; i >= 0; i--) {
      if (filtered[i].type === 'AgentMessage') { agentIdx = filtered.length - 1 - i; break }
    }
    const totalLen = keys.reduce((sum, k) => sum + (streamingBuffers[k]?.length || 0), 0)
    return { sessionEvents: filtered, streamingMessageId: msgId, lastAgentIdx: agentIdx, streamTotalLen: totalLen }
  }, [events, sessionId, streamingBuffers])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(dist > SCROLL_THRESHOLD_PX)
  }, [])

  const scrollToBottom = () => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })
  }

  // Auto-scroll when new events arrive OR streaming buffer changes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    if (dist < SCROLL_THRESHOLD_PX) el.scrollTop = el.scrollHeight
  }, [sessionEvents.length, streamTotalLen])

  if (sessionEvents.length === 0 && streamTotalLen === 0) {
    return (
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col items-center justify-center h-full px-6 pb-20 text-center">
          <p className="text-xl text-[var(--app-text)] mb-6 font-medium">What can I help with?</p>
          <div className="flex flex-wrap justify-center gap-2 max-w-lg">
            {['Explain quantum computing', 'Write a Python script', 'Summarize a document', 'Review my code'].map((s) => (
              <button key={s} onClick={() => setEditText(s)} className="px-4 py-2 rounded-full border border-[var(--app-border)] text-sm text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:border-[var(--app-text-dim)] hover:bg-[var(--app-bg-hover)] transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 relative" ref={containerRef} onScroll={handleScroll}>
      <div className="px-6 py-2 max-w-[48rem] mx-auto">
        {sessionEvents.map((event, idx) => {
          const isLastAgent = event.type === 'AgentMessage' && lastAgentIdx >= 0 && idx === sessionEvents.length - 1 - lastAgentIdx
          return <EventCard key={event.id} event={event} streamingMessageId={isLastAgent ? streamingMessageId : undefined} />
        })}
      </div>
      <div className="h-4" />
      {showScrollBtn && (
        <button onClick={scrollToBottom} className="absolute bottom-4 right-6 w-8 h-8 rounded-full bg-[var(--app-bg-elevated)] border border-[var(--app-border)] shadow-md flex items-center justify-center hover:bg-[var(--app-bg-hover)] transition-colors z-10">
          <ArrowDown className="w-4 h-4 text-[var(--app-text-secondary)]" />
        </button>
      )}
    </div>
  )
}

/**
 * EventCard — renders a single session event.
 * SessionEvent is now a discriminated union: switch(event.type) auto-narrows event.payload.
 * No payload casts needed.
 */
const EventCard = memo(function EventCard({ event, streamingMessageId }: { event: SessionEvent; streamingMessageId?: string }) {
  const setEditText = useSetAtom(editTextAtom)
  switch (event.type) {
    case 'UserMessage':
      return <UserMessageEvent payload={event.payload} onEdit={(text) => setEditText(text)} />
    case 'AgentMessage':
      return <AgentMessageEvent payload={event.payload} streamingMessageId={streamingMessageId} onRegenerate={() => {}} />
    case 'PlanCreated':
      return <PlanCreatedEvent payload={event.payload} />
    case 'ToolCallStarted':
      return <ToolCallStartedEvent payload={event.payload} />
    case 'ToolCallFinished':
      return <ToolCallFinishedEvent payload={event.payload} />
    case 'ArtifactCreated':
      return <ArtifactCreatedEvent payload={event.payload} />
    case 'TaskCompleted':
      return <TaskCompletedEvent payload={event.payload} />
    case 'SystemNotification':
      if (event.payload.kind === 'no_model') return <NoModelPrompt />
      return null
    case 'TaskFailed':
      return <TaskFailedEvent payload={event.payload} taskId={event.taskId} sessionId={event.sessionId} />
    case 'PermissionRequested':
      return <PermissionRequestedEvent payload={event.payload} />
    default:
      return null
  }
})
