export default function GeneralSettings() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-200 mb-4">General</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300">File open behavior</p>
            <p className="text-[11px] text-neutral-600">Where new files open in the editor</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">
            Current Tab ▾
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-300">Command output verbosity</p>
            <p className="text-[11px] text-neutral-600">Detail level for agent command output</p>
          </div>
          <span className="text-[11px] text-neutral-400 border border-neutral-700 rounded px-2 py-0.5">
            Default ▾
          </span>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="rounded bg-neutral-800 border-neutral-600" />
          <div>
            <p className="text-xs text-neutral-300">Require ⌘+Enter to send</p>
            <p className="text-[11px] text-neutral-600">Prevent accidental sends with Enter alone</p>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="rounded bg-neutral-800 border-neutral-600" />
          <div>
            <p className="text-xs text-neutral-300">Prevent sleep while running</p>
            <p className="text-[11px] text-neutral-600">Keep computer awake during long tasks</p>
          </div>
        </label>
      </div>
    </div>
  )
}
