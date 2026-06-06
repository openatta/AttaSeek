import { useSetAtom } from 'jotai'
import type { TaskFailedPayload } from '../../../../shared/types/SessionEvent'
import { agentTasksAtom } from '../../../atoms/sessionAtom'

interface Props { payload: TaskFailedPayload; taskId?: string; sessionId?: string }

export default function TaskFailedEvent({ payload, taskId }: Props) {
  const setTasks = useSetAtom(agentTasksAtom)

  return (
    <div className="py-3">
      <div className="text-xs font-semibold text-red-400 mb-1">Error</div>
      <p className="text-xs text-[var(--app-text-secondary)] mb-2">{payload.error}</p>
      {payload.recoverable && (
        <button
          onClick={() => { if (taskId) setTasks((prev) => prev.filter((t) => t.id !== taskId)) }}
          className="px-3 py-1 rounded-md text-[11px] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]"
        >
          Retry
        </button>
      )}
    </div>
  )
}
