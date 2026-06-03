export default function ProfileSettings() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--app-text)] mb-4">Profile</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Lifetime tokens', value: '12.4M' },
            { label: 'Peak tokens', value: '1.2M' },
            { label: 'Streaks', value: '14 days' },
            { label: 'Longest task', value: '3h 22m' }
          ].map((s) => (
            <div key={s.label} className="px-4 py-3 rounded-lg bg-[var(--app-bg-inset)] border border-[var(--app-border)]">
              <p className="text-[11px] text-[var(--app-text-secondary)]">{s.label}</p>
              <p className="text-sm text-[var(--app-text)] font-mono mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
