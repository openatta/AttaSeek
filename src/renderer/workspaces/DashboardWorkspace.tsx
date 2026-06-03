/**
 * Dashboard workspace — full-width view with stats and Quick Start.
 * Header is a bare draggable region.
 */

const MOCK_STATS = {
  conversations: { count: 5, recent: ['Refactor API module', 'Write test suite', 'Fix bridge connection', 'Update proto definitions', 'Review PR #42'] },
  projects: { count: 3, recent: ['AttaSeek', 'ClawPod', 'AttaCloud'] },
  automations: { count: 2 },
  plugins: { count: 4 },
  engine: { tokensToday: '1.2M', requestsToday: 48, avgLatency: '320ms' }
}

export default function DashboardWorkspace() {
  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Draggable header — empty, just for window drag */}
      <div
        className="flex-shrink-0 h-[40px]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* Content — vertically centered */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Stat cards row */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Conversations', value: MOCK_STATS.conversations.count },
              { label: 'Projects', value: MOCK_STATS.projects.count },
              { label: 'Automations', value: MOCK_STATS.automations.count },
              { label: 'Plugins', value: MOCK_STATS.plugins.count },
              { label: 'Requests Today', value: MOCK_STATS.engine.requestsToday }
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] px-4 py-3 text-center"
              >
                <p className="text-2xl font-semibold text-[var(--app-text)]">{s.value}</p>
                <p className="text-[10px] text-[var(--app-text-dim)] mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Engine stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Tokens Today', value: MOCK_STATS.engine.tokensToday },
              { label: 'Avg Latency', value: MOCK_STATS.engine.avgLatency },
              { label: 'Uptime', value: '99.8%' }
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-[var(--app-border)] px-4 py-3 flex items-center justify-between"
              >
                <span className="text-xs text-[var(--app-text-secondary)]">{s.label}</span>
                <span className="text-sm font-medium text-[var(--app-text)]">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Recent conversations + Recent projects */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] p-4">
              <h3 className="text-xs font-semibold text-[var(--app-text)] mb-3 uppercase tracking-wider">
                Recent Conversations
              </h3>
              <div className="space-y-1.5">
                {MOCK_STATS.conversations.recent.map((name, i) => (
                  <div key={i} className="text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] cursor-pointer px-2 py-1 rounded hover:bg-[var(--app-bg-hover)] transition-colors">
                    {name}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] p-4">
              <h3 className="text-xs font-semibold text-[var(--app-text)] mb-3 uppercase tracking-wider">
                Recent Projects
              </h3>
              <div className="space-y-1.5">
                {MOCK_STATS.projects.recent.map((name, i) => (
                  <div key={i} className="text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] cursor-pointer px-2 py-1 rounded hover:bg-[var(--app-bg-hover)] transition-colors">
                    {name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Start */}
          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] p-4">
            <h3 className="text-xs font-medium text-[var(--app-text)] mb-2">Quick Start</h3>
            <textarea
              className="w-full bg-[var(--app-bg)] border border-[var(--app-border)] rounded-md px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-dim)] resize-none outline-none focus:border-[var(--app-accent)] transition-colors"
              placeholder="What do you want to build?"
              rows={2}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
