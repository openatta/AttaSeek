import { useState } from 'react'
import { MOCK_TASKS } from './mock/automation'
import AutomationSidebar from './AutomationSidebar'

export default function AutomationWorkspace() {
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_TASKS[0]?.id ?? null)

  const task = MOCK_TASKS.find((t) => t.id === selectedId)

  return (
    <div className="flex flex-1 min-w-0">
      {/* Left sidebar */}
      <div
        className="flex-shrink-0 border-r border-[var(--app-border)] flex flex-col"
        style={{ width: 260 }}
      >
        <AutomationSidebar selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Main content — task detail */}
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
                  <span className="text-2xl">📋</span>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--app-text)]">{task.name}</h3>
                    <p className="text-[11px] text-[var(--app-text-dim)] mt-0.5">
                      {task.triggerType === 'cron' ? 'Scheduled' : task.triggerType === 'hook' ? 'Event-driven' : 'Manual'}
                    </p>
                  </div>
                  <div className="flex-1" />
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium
                    ${task.status === 'running' ? 'bg-green-500/10 text-green-400' :
                      task.status === 'idle' ? 'bg-[var(--app-bg-hover)] text-[var(--app-text-secondary)]' :
                      task.status === 'scheduled' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-[var(--app-bg-hover)] text-[var(--app-text-dim)]'}`}
                  >
                    {task.status === 'running' ? 'Running' :
                     task.status === 'idle' ? 'Idle' :
                     task.status === 'scheduled' ? 'Scheduled' :
                     'Stopped'}
                  </span>
                </div>

                <p className="text-xs text-[var(--app-text-secondary)] leading-relaxed mb-4">
                  {task.description}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="px-3 py-2 rounded-md bg-[var(--app-bg)] border border-[var(--app-border)]">
                    <p className="text-[10px] text-[var(--app-text-dim)] uppercase tracking-wider mb-0.5">Trigger</p>
                    <p className="text-xs text-[var(--app-text)]">{task.trigger}</p>
                  </div>
                  <div className="px-3 py-2 rounded-md bg-[var(--app-bg)] border border-[var(--app-border)]">
                    <p className="text-[10px] text-[var(--app-text-dim)] uppercase tracking-wider mb-0.5">Last Run</p>
                    <p className="text-xs text-[var(--app-text)]">{task.lastRun || 'Never'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {task.status === 'running' ? (
                    <button className="px-3 py-1.5 rounded-md text-[11px] bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors">
                      Pause
                    </button>
                  ) : task.status !== 'stopped' ? (
                    <button className="px-3 py-1.5 rounded-md text-[11px] bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                      Start
                    </button>
                  ) : null}
                  <button className="px-3 py-1.5 rounded-md text-[11px] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors">
                    Edit
                  </button>
                  <button className="px-3 py-1.5 rounded-md text-[11px] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors">
                    View Log
                  </button>
                </div>
              </div>

              {/* Run history placeholder */}
              <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] p-4">
                <h4 className="text-xs font-semibold text-[var(--app-text)] mb-2">Recent Runs</h4>
                <div className="space-y-1.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 text-[11px]">
                      <span className="text-green-400">✓</span>
                      <span className="text-[var(--app-text-secondary)]">{i === 1 ? '3m ago' : i === 2 ? '24h ago' : '2d ago'}</span>
                      <span className="text-[var(--app-text-dim)]">Duration: {i === 1 ? '12s' : i === 2 ? '18s' : '9s'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-[var(--app-text-dim)]">Select a task to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
