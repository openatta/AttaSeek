export default function ConfigurationSettings() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--app-text)] mb-4">Configuration</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--app-text)]">Model</p>
            <p className="text-[11px] text-[var(--app-text-dim)]">Default AI model for new sessions</p>
          </div>
          <span className="text-[11px] text-[var(--app-text-secondary)] border border-[var(--app-border)] rounded px-2 py-0.5">
            Opus 4.7 ▾
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--app-text)]">Reasoning effort</p>
          </div>
          <span className="text-[11px] text-[var(--app-text-secondary)] border border-[var(--app-border)] rounded px-2 py-0.5">
            Medium ▾
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--app-text)]">Approval policy</p>
          </div>
          <span className="text-[11px] text-[var(--app-text-secondary)] border border-[var(--app-border)] rounded px-2 py-0.5">
            Default Review ▾
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--app-text)]">Sandbox mode</p>
          </div>
          <span className="text-[11px] text-[var(--app-text-secondary)] border border-[var(--app-border)] rounded px-2 py-0.5">
            Workspace Write ▾
          </span>
        </div>
      </div>
    </div>
  )
}
