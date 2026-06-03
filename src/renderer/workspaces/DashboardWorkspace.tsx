/**
 * Dashboard workspace — single scrollable view.
 * No zone split — a freeform content page.
 */
export default function DashboardWorkspace() {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-[var(--app-text)] mb-1">Dashboard</h2>
          <p className="text-xs text-[var(--app-text-dim)]">Project overview and quick actions</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active Sessions', value: '—' },
            { label: 'Pending Reviews', value: '—' },
            { label: 'Automations', value: '—' }
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] px-4 py-3"
            >
              <p className="text-[11px] text-[var(--app-text-secondary)]">{s.label}</p>
              <p className="text-lg font-semibold text-[var(--app-text)] mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] p-4">
          <h3 className="text-xs font-medium text-[var(--app-text)] mb-2">Quick Start</h3>
          <textarea
            className="w-full bg-[var(--app-bg)] border border-[var(--app-border)] rounded-md px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-dim)] resize-none outline-none focus:border-[var(--app-accent)] transition-colors"
            placeholder="What do you want to work on?"
            rows={2}
          />
        </div>
      </div>
    </div>
  )
}
