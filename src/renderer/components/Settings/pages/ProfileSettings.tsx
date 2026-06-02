export default function ProfileSettings() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-200 mb-4">Profile</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Lifetime tokens', value: '12.4M' },
            { label: 'Peak tokens', value: '1.2M' },
            { label: 'Streaks', value: '14 days' },
            { label: 'Longest task', value: '3h 22m' }
          ].map((s) => (
            <div key={s.label} className="px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800">
              <p className="text-[11px] text-neutral-500">{s.label}</p>
              <p className="text-sm text-neutral-200 font-mono mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
