/**
 * Search workspace — 2-zone:
 *   [Left: search facets]  [Main: results]
 */
export default function SearchWorkspace() {
  return (
    <div className="flex flex-1 min-w-0">
      <div
        className="flex-shrink-0 border-r border-[var(--app-border)] overflow-y-auto flex flex-col"
        style={{ width: 220 }}
      >
        <div
          className="flex-shrink-0 h-[40px] flex items-center px-4"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
            SEARCH
          </h2>
        </div>
        <div className="p-4 space-y-2">
          {['All', 'Sessions', 'Files', 'Commands', 'Plugins'].map((f) => (
            <button
              key={f}
              className="block w-full text-left px-3 py-1.5 rounded-md text-xs
                         text-[var(--app-text-secondary)] hover:text-[var(--app-text)]
                         hover:bg-[var(--app-bg-hover)] transition-colors"
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-center">
        <p className="text-xs text-[var(--app-text-dim)]">Search — start typing to find content</p>
      </div>
    </div>
  )
}
