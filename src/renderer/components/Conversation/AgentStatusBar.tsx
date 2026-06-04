import { useAtomValue } from 'jotai'
import { agentTasksAtom, currentSessionIdAtom } from '../../atoms/sessionAtom'
import type { AgentTaskStatus } from '../../core/types/AgentTask'

const STATUS_LABEL: Record<AgentTaskStatus, string> = {
  idle: 'Ready',
  intake: 'Understanding…',
  context_assembling: 'Gathering context…',
  skill_selecting: 'Selecting skills…',
  planning: 'Planning…',
  awaiting_permission: 'Waiting for permission…',
  executing: 'Executing…',
  generating_artifact: 'Generating artifact…',
  verifying: 'Verifying…',
  writing_memory: 'Saving…',
  completed: 'Completed',
  paused: 'Paused',
  waiting_user_input: 'Waiting for input…',
  failed: 'Failed',
  cancelled: 'Cancelled',
  denied: 'Denied',
}

const STATUS_COLOR_CLASS: Record<string, string> = {
  completed: 'bg-green-400',
  failed: 'bg-red-400',
  cancelled: 'bg-yellow-400',
  denied: 'bg-red-400',
}

/**
 * Agent status indicator bar.
 * Shows current task status from agentTasksAtom.
 * Hidden when no active tasks.
 */
export default function AgentStatusBar() {
  const tasks = useAtomValue(agentTasksAtom)
  const sessionId = useAtomValue(currentSessionIdAtom)

  const activeTasks = tasks.filter(
    (t) =>
      t.sessionId === sessionId &&
      !['completed', 'failed', 'cancelled', 'denied'].includes(t.status),
  )

  if (activeTasks.length === 0) return null

  return (
    <div className="flex-shrink-0 px-4 py-2 border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
      {activeTasks.map((task) => (
        <div key={task.id} className="flex items-center gap-2 text-xs">
          <span
            className={`inline-block w-2 h-2 rounded-full animate-pulse ${
              STATUS_COLOR_CLASS[task.status] || 'bg-[var(--app-accent)]'
            }`}
          />
          <span className="text-[var(--app-text-secondary)]">
            {STATUS_LABEL[task.status] || task.status}
          </span>
          {task.plan && (
            <span className="text-[var(--app-text-dim)]">
              • {task.plan.steps.filter((s) => s.status === 'completed').length}/
              {task.plan.steps.length} steps
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
