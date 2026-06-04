/**
 * Search workspace — internal 220px facet sidebar + results area.
 * SidebarSlot is null for search; workspace owns its sidebar.
 */

export default function SearchWorkspace() {
  return (
    <div className="flex h-full min-w-0">
      {/* Internal sidebar */}
      <div
        className="flex-shrink-0 border-r border-[var(--app-border)] overflow-y-auto flex flex-col h-full"
        style={{ width: 220 }}
      >
        {/* Drag region */}
        <div
          className="flex-shrink-0 h-[40px]"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />
        {/* Title */}
        <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider px-4 pb-2">
          SEARCH
        </h2>
        {/* Facets */}
        <div className="px-4 pb-4 space-y-2">
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

      {/* Results */}
      <div className="flex-1 min-w-0 flex items-center justify-center">
        <p className="text-xs text-[var(--app-text-dim)]">Search — start typing to find content</p>
      </div>
    </div>
  )
}
