/**
 * Automation workspace — 2-zone:
 *   [Left: task list]  [Main: content]
 */
export default function AutomationWorkspace() {
  return (
    <div className="flex flex-1 min-w-0">
      <div
        className="flex-shrink-0 border-r border-[var(--app-border)] overflow-y-auto flex flex-col"
        style={{ width: 260 }}
      >
        <div
          className="flex-shrink-0 h-[40px] flex items-center px-4"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
            AUTOMATION
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-[var(--app-text-dim)] text-center">
            Scheduled tasks and workflows — coming soon
          </p>
        </div>
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-center">
        <p className="text-xs text-[var(--app-text-dim)]">Automation — coming soon</p>
      </div>
    </div>
  )
}
