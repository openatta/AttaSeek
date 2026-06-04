/**
 * PluginSidebar — category list sidebar for Plugin activity.
 * Extracted from PluginWorkspace for Shell-managed SidebarSlot rendering.
 */

import { useState } from 'react'
import { MOCK_CATEGORIES, type PluginItem } from './mock/plugins'

interface PluginSidebarProps {
  selectedPluginId?: string | null
  onSelectPlugin?: (plugin: PluginItem) => void
}

export default function PluginSidebar({ selectedPluginId, onSelectPlugin }: PluginSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(MOCK_CATEGORIES.map((c) => c.id))
  )

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full">
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
                    onClick={() => onSelectPlugin?.(p)}
                    className={`w-full text-left px-2 py-1 text-xs rounded transition-colors
                      ${selectedPluginId === p.id
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
  )
}
