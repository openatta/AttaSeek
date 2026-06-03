import ChatsList from '../components/Sidebar/ChatsList'
import { Plus } from 'lucide-react'

export default function ChatsSidebar() {
  return (
    <div className="flex flex-col h-full">
      {/* Draggable header — empty, just for window drag */}
      <div
        className="flex-shrink-0 h-[40px]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* Content header: CHATS title + + button */}
      <div className="flex items-center px-4 pb-2">
        <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
          CHATS
        </h2>
        <div className="flex-1" />
        <button
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
          title="New Session"
          aria-label="New Session"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ChatsList />
      </div>
    </div>
  )
}
