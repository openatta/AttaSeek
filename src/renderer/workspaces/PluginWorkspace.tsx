import { useState } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import { MOCK_CATEGORIES, type PluginItem } from './mock/plugins'

type View = 'marketplace' | 'installed' | 'updates'

export default function PluginWorkspace() {
  const [view, setView] = useState<View>('installed')
  const [selectedPlugin, setSelectedPlugin] = useState<PluginItem | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(MOCK_CATEGORIES.map((c) => c.id))
  )
  const [search, setSearch] = useState('')

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredPlugins = MOCK_CATEGORIES.flatMap((c) => c.plugins).filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    if (view === 'installed') return p.installed
    if (view === 'updates') return p.installed // mock: same as installed for now
    return true
  })

  return (
    <div className="flex flex-1 min-w-0">
      {/* Left sidebar — categories */}
      <div className="flex-shrink-0 w-[260px] border-r border-[var(--app-border)] flex flex-col">
        <div
          className="flex-shrink-0 h-[40px]"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />
        <div className="flex items-center px-4 pb-2">
          <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
            PLUGINS
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {MOCK_CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] rounded transition-colors"
              >
                <span className="text-[10px]">{expandedCategories.has(cat.id) ? '▼' : '▶'}</span>
                <span>{cat.label}</span>
                <span className="text-[10px] text-[var(--app-text-dim)] ml-auto">{cat.plugins.length}</span>
              </button>
              {expandedCategories.has(cat.id) && (
                <div className="ml-4 mb-1">
                  {cat.plugins.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlugin(p)}
                      className={`w-full text-left px-2 py-1 text-xs rounded transition-colors
                        ${selectedPlugin?.id === p.id
                          ? 'text-[var(--app-text)] bg-[var(--app-bg-active)]'
                          : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]'
                        }`}
                    >
                      <span className="mr-1.5">{p.icon}</span>
                      {p.name}
                      {p.installed && (
                        <span className="ml-1.5 text-[10px] text-[var(--app-text-dim)]">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main — list or detail */}
      <div className="flex flex-col flex-1 min-w-0">
        {selectedPlugin ? (
          <>
            {/* Detail header */}
            <div
              className="flex-shrink-0 h-[40px] flex items-center gap-2 px-4 border-b border-[var(--app-border)]"
              style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
              <button
                onClick={() => setSelectedPlugin(null)}
                className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-[var(--app-text)]">{selectedPlugin.name}</span>
            </div>

            {/* Detail content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-lg">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{selectedPlugin.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--app-text)]">{selectedPlugin.name}</h3>
                    <p className="text-[11px] text-[var(--app-text-dim)]">v{selectedPlugin.version}</p>
                  </div>
                  <div className="flex-1" />
                  {selectedPlugin.installed ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--app-bg-active)] text-[var(--app-text-secondary)]">
                      Installed
                    </span>
                  ) : (
                    <button className="px-3 py-1 rounded text-[11px] bg-blue-600 text-white hover:bg-blue-500 transition-colors">
                      Install
                    </button>
                  )}
                </div>

                <p className="text-xs text-[var(--app-text-secondary)] leading-relaxed mb-4">
                  {selectedPlugin.description}
                </p>

                {selectedPlugin.installed && (
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 rounded-md text-[11px] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors">
                      Configure
                    </button>
                    <button className="px-3 py-1.5 rounded-md text-[11px] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors">
                      Docs
                    </button>
                    <button className="px-3 py-1.5 rounded-md text-[11px] border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors">
                      Uninstall
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* List header */}
            <div
              className="flex-shrink-0 h-[40px] flex items-center px-4 border-b border-[var(--app-border)]"
              style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
              <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                {(['marketplace', 'installed', 'updates'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-md text-[11px] transition-colors
                      ${view === v
                        ? 'bg-[var(--app-bg-active)] text-[var(--app-text)]'
                        : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)]'
                      }`}
                  >
                    {v === 'marketplace' ? 'Marketplace' : v === 'installed' ? 'Installed' : 'Updates'}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--app-text-dim)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-36 pl-6 pr-2 py-1 rounded-md bg-[var(--app-bg-inset)] border border-[var(--app-border)] text-[11px] text-[var(--app-text)] placeholder:text-[var(--app-text-dim)] outline-none focus:border-[var(--app-accent)]"
                  placeholder="Search..."
                />
              </div>
            </div>

            {/* Plugin grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-3">
                {filteredPlugins.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlugin(p)}
                    className="text-left p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] hover:border-[var(--app-accent-border)] transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{p.icon}</span>
                      <div>
                        <p className="text-xs font-medium text-[var(--app-text)]">{p.name}</p>
                        <p className="text-[10px] text-[var(--app-text-dim)]">v{p.version}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--app-text-secondary)] leading-snug line-clamp-2">
                      {p.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
