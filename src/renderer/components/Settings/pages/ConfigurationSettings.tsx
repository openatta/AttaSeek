export default function ConfigurationSettings() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-200 mb-4">Configuration</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300">Model</p>
            <p className="text-[11px] text-neutral-600">Default AI model for new sessions</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">
            Opus 4.7 ▾
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300">Reasoning effort</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">
            Medium ▾
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300">Approval policy</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">
            Default Review ▾
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300">Sandbox mode</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">
            Workspace Write ▾
          </span>
        </div>
      </div>
    </div>
  )
}
