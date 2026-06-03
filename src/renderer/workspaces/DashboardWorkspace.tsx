/**
 * Dashboard workspace — single view, full width.
 * No sidebars, no output area — just a centered Quick Start.
 */
export default function DashboardWorkspace() {
  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Draggable header */}
      <div
        className="flex-shrink-0 h-[40px] flex items-center px-4"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-[11px] text-[var(--app-text-dim)] select-none">AttaSeek</span>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="w-16 h-16 rounded-2xl bg-[var(--app-bg-hover)] flex items-center justify-center mb-6">
          <span className="text-2xl text-[var(--app-text-dim)]">◈</span>
        </div>
        <h2 className="text-lg font-semibold text-[var(--app-text)] mb-1">AttaSeek</h2>
        <p className="text-xs text-[var(--app-text-dim)] mb-8">Agent Workspace</p>

        <div className="w-full max-w-lg">
          <textarea
            className="w-full bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded-lg
                       px-4 py-3 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-dim)]
                       resize-none outline-none
                       focus:border-[var(--app-accent)] focus:ring-1 focus:ring-[var(--app-accent-border)]
                       transition-colors"
            placeholder="What do you want to build?"
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}
