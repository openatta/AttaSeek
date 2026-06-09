import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import ChatsList from '../components/Sidebar/ChatsList'
import { currentSessionIdAtom, sessionEventsAtom } from '../atoms/sessionAtom'
import { createTempSessionId } from '../../shared/constants'
import { Plus } from 'lucide-react'

export default function ChatsSidebar() {
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom)
  const setSessionEvents = useSetAtom(sessionEventsAtom)

  const handleNewSession = useCallback(() => {
    // Temp ID — only persisted when first message is sent (agent:create-task)
    const tempId = createTempSessionId()
    setCurrentSessionId(tempId)
    setSessionEvents([])
  }, [setCurrentSessionId, setSessionEvents])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4 pb-2">
        <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">CHATS</h2>
        <div className="flex-1" />
        <button
          onClick={handleNewSession}
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
          title="New Session" aria-label="New Session"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <ChatsList />
      </div>
    </div>
  )
}
