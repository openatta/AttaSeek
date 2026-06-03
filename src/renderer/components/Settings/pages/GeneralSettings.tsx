export default function GeneralSettings() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--app-text)] mb-4">General</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--app-text)]">File open behavior</p>
            <p className="text-[11px] text-[var(--app-text-dim)]">Where new files open in the editor</p>
          </div>
          <span className="text-[11px] text-[var(--app-text-secondary)] border border-[var(--app-border)] rounded px-2 py-0.5">
            Current Tab ▾
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--app-text)]">Command output verbosity</p>
            <p className="text-[11px] text-[var(--app-text-dim)]">Detail level for agent command output</p>
          </div>
          <span className="text-[11px] text-[var(--app-text-secondary)] border border-[var(--app-border)] rounded px-2 py-0.5">
            Default ▾
          </span>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="rounded bg-[var(--app-bg-inset)] border-[var(--app-border)]" />
          <div>
            <p className="text-xs text-[var(--app-text)]">Require ⌘+Enter to send</p>
            <p className="text-[11px] text-[var(--app-text-dim)]">Prevent accidental sends with Enter alone</p>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="rounded bg-[var(--app-bg-inset)] border-[var(--app-border)]" />
          <div>
            <p className="text-xs text-[var(--app-text)]">Prevent sleep while running</p>
            <p className="text-[11px] text-[var(--app-text-dim)]">Keep computer awake during long tasks</p>
          </div>
        </label>
      </div>
    </div>
  )
}
