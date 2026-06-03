/**
 * Plugin workspace — 2-zone:
 *   [Left: plugin list]  [Main: plugin detail]
 */
export default function PluginWorkspace() {
  return (
    <div className="flex flex-1 min-w-0">
      <div
        className="flex-shrink-0 border-r border-[var(--app-border)] overflow-y-auto"
        style={{ width: '260px' }}
      >
        <div className="h-[40px] flex items-center px-4">
          <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
            Plugins
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-[var(--app-text-dim)] text-center">
            Installed plugins and marketplace — coming soon
          </p>
        </div>
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-center">
        <p className="text-xs text-[var(--app-text-dim)]">Select a plugin to view details</p>
      </div>
    </div>
  )
}
