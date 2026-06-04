import { useState } from 'react'
import { MOCK_TASKS } from './mock/automation'

/**
 * Automation workspace main content — task detail view.
 * Sidebar (AutomationSidebar) is now rendered by Shell's SidebarSlot.
 */
export default function AutomationWorkspace() {
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_TASKS[0]?.id ?? null)
  const task = MOCK_TASKS.find((t) => t.id === selectedId)

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div
        className="flex-shrink-0 h-[40px]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {task ? (
          <div className="max-w-2xl space-y-4">
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-lg">📋</span>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--app-text)]">{task.name}</h3>
                  <p className="text-[11px] text-[var(--app-text-dim)]">{task.triggerType} · {task.trigger}</p>
                </div>
                <div className="flex-1" />
                <span className={`px-2 py-0.5 rounded text-[10px] ${
                  task.status === 'running' ? 'bg-green-500/10 text-green-500' :
                  task.status === 'idle' ? 'bg-blue-500/10 text-blue-500' :
                  task.status === 'scheduled' ? 'bg-yellow-500/10 text-yellow-500' :
                  'bg-gray-500/10 text-gray-500'
                }`}>
                  {task.status}
                </span>
              </div>
              <p className="text-xs text-[var(--app-text-secondary)] mb-1">{task.description}</p>
              {task.lastRun && (
                <p className="text-[11px] text-[var(--app-text-dim)]">Last run: {task.lastRun}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-[var(--app-text-tertiary)]">
            Select an automation task
          </div>
        )}
      </div>
    </div>
  )
}
