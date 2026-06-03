export default function PersonalizationSettings() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--app-text)] mb-4">Personalization</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--app-text)]">Personality tone</p>
            <p className="text-[11px] text-[var(--app-text-dim)]">Default interaction style</p>
          </div>
          <span className="text-[11px] text-[var(--app-text-secondary)] border border-[var(--app-border)] rounded px-2 py-0.5">
            Pragmatic ▾
          </span>
        </div>
        <div>
          <p className="text-xs text-[var(--app-text)] mb-1">Custom instructions</p>
          <textarea
            className="w-full bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded-md px-3 py-2 text-xs text-[var(--app-text)] placeholder:text-[var(--app-text-dim)] resize-none outline-none focus:border-[var(--app-accent)] transition-colors"
            placeholder="Add custom behavior instructions..."
            rows={4}
          />
        </div>
      </div>
    </div>
  )
}
