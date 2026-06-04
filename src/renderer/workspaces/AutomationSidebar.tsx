import type { AutomationTask } from './mock/automation'
import { MOCK_TASKS } from './mock/automation'

const STATUS_ICON: Record<AutomationTask['status'], string> = {
  running: '◉',
  idle: '◎',
  scheduled: '◐',
  stopped: '○'
}

const STATUS_COLOR: Record<AutomationTask['status'], string> = {
  running: 'text-green-400',
  idle: 'text-[var(--app-text-dim)]',
  scheduled: 'text-amber-400',
  stopped: 'text-[var(--app-text-dim)] opacity-40'
}

interface Props {
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function AutomationSidebar({ selectedId, onSelect }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Title — drag header provided by SidebarSlot */}
      <div className="flex items-center px-4 pb-2">
        <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
          AUTOMATION
        </h2>
      </div>

      {/* Task list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {MOCK_TASKS.map((task) => (
          <button
            key={task.id}
            onClick={() => onSelect(task.id)}
            className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-colors
              ${selectedId === task.id
                ? 'bg-[var(--app-bg-active)]'
                : 'hover:bg-[var(--app-bg-hover)]'
              }`}
          >
            <span className={`text-sm flex-shrink-0 ${STATUS_COLOR[task.status]}`}>
              {STATUS_ICON[task.status]}
            </span>
            <span className="text-xs text-[var(--app-text)] truncate">{task.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
