export default function PersonalizationSettings() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-200 mb-4">Personalization</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300">Personality tone</p>
            <p className="text-[11px] text-neutral-600">Default interaction style</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">
            Pragmatic ▾
          </span>
        </div>
        <div>
          <p className="text-xs text-neutral-300 mb-1">Custom instructions</p>
          <textarea
            className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 resize-none outline-none focus:border-neutral-500 transition-colors"
            placeholder="Add custom behavior instructions..."
            rows={4}
          />
        </div>
      </div>
    </div>
  )
}
