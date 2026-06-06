/**
 * ArtifactPane — full artifact display, editing, and review area.
 * Shell-owned panel rendered in AppSpace's right slot.
 *
 * Tabs are driven by ArtifactType (from ArtifactRendererRegistry), not the old OutputTab model.
 * When an artifact is created, its type determines the renderer.
 */

import { useState, useMemo } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { outputTabsAtom, activeOutputTabAtom, outputAreaVisibleAtom, outputFullscreenAtom } from '../../atoms/outputTabsAtom'
import { artifactsAtom, activeArtifactAtom } from '../../atoms/sessionAtom'
import { getRenderer, listRenderers } from '../../registries/artifactRendererRegistry'
import { PanelRightClose, Expand, Shrink, Plus, X } from 'lucide-react'
import type { OutputTab, OutputTabType } from '../../atoms/outputTabsAtom'

const TYPE_LABELS: Record<string, string> = {
  markdown: 'Markdown', html: 'HTML', svg: 'SVG', table: 'Table',
  code: 'Code', diff: 'Diff', json: 'JSON',
  files: 'Files', terminal: 'Terminal', browser: 'Browser', review: 'Review',
}

const TYPE_ICONS: Record<string, string> = {
  markdown: '📄', html: '🌐', svg: '🖼', table: '📊',
  code: '⌨', diff: '🔍', json: '{ }',
  files: '📁', terminal: '⬛', browser: '🌐', review: '📝',
}

export default function ArtifactPane() {
  const [tabs, setTabs] = useAtom(outputTabsAtom)
  const [activeTab, setActiveTab] = useAtom(activeOutputTabAtom)
  const visible = useAtomValue(outputAreaVisibleAtom)
  const [fullscreen, setFullscreen] = useAtom(outputFullscreenAtom)
  const [, setOutputVisible] = useAtom(outputAreaVisibleAtom)
  const artifacts = useAtomValue(artifactsAtom)
  const [activeArtifact, setActiveArtifact] = useAtom(activeArtifactAtom)
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  // Available artifact types from registry
  const rendererTypes = useMemo(() => listRenderers().map((r) => r.type), [])

  // Open an artifact in a tab
  const openArtifact = (artifactId: string) => {
    const artifact = artifacts.find((a) => a.id === artifactId)
    if (!artifact) return

    setActiveArtifact(artifactId)

    // Check if tab already exists for this artifact
    const existing = tabs.find((t) => t.id === artifactId)
    if (!existing) {
      setTabs((prev) => [
        ...prev,
        { id: artifactId, type: artifact.type, label: artifact.title },
      ])
    }
    setActiveTab(artifactId)
    setAddMenuOpen(false)
  }

  // Add a tab by artifact type (from registry)
  const addTab = (type: OutputTabType) => {
    // Find matching artifact or create an empty tab
    const matchingArtifact = artifacts.find((a) => a.type === type)
    if (matchingArtifact) {
      openArtifact(matchingArtifact.id)
      return
    }
    const id = `tab-${Date.now()}`
    const label = TYPE_LABELS[type] || type
    setTabs((prev) => [...prev, { id, type, label }])
    setActiveTab(id)
    setAddMenuOpen(false)
  }

  const closeTab = (tabId: string) => {
    const newTabs = tabs.filter((t) => t.id !== tabId)
    setTabs(newTabs)
    if (activeTab === tabId) {
      if (newTabs.length > 0) setActiveTab(newTabs[newTabs.length - 1].id)
      else setActiveTab(null)
    }
  }

  if (!visible) return null

  const currentTab = tabs.find((t) => t.id === activeTab)

  return (
    <div className="flex flex-col flex-1 bg-[var(--app-bg-secondary)]">
      {/* Header bar — matches SessionHeader height (40px), draggable */}
      <div
        className="flex items-center h-[40px] px-2 border-b border-[var(--app-border)] flex-shrink-0 gap-1"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto flex-1 min-w-0">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded cursor-pointer transition-colors whitespace-nowrap select-none ${
                activeTab === tab.id
                  ? 'bg-[var(--app-bg-primary)] text-[var(--app-text-primary)]'
                  : 'text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]'
              }`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                className="flex-shrink-0 rounded-sm hover:bg-[var(--app-bg-hover)]"
                title="Close"
              >
                <X className="w-3 h-3" />
              </button>
              <span className="text-xs">{TYPE_ICONS[tab.type] || '📄'}</span>
              <span>{tab.label}</span>
            </div>
          ))}

          {/* + Add tab — lists artifact types from registry */}
          <div className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              className="flex items-center justify-center w-6 h-6 rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors"
              title="Add tab"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {addMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg z-50 py-1">
                {/* First: suggest open artifacts */}
                {artifacts.filter((a) => !tabs.find((t) => t.id === a.id)).slice(0, 5).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => openArtifact(a.id)}
                    className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors flex items-center gap-2"
                  >
                    <span>{TYPE_ICONS[a.type] || '📄'}</span>
                    <span>{a.title.slice(0, 30)}</span>
                  </button>
                ))}
                {artifacts.some((a) => !tabs.find((t) => t.id === a.id)) && (
                  <div className="border-t border-[var(--app-border)] my-1" />
                )}
                {/* Then: renderer types */}
                {rendererTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => addTab(type)}
                    className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors flex items-center gap-2"
                  >
                    <span>{TYPE_ICONS[type] || '📄'}</span>
                    <span>{TYPE_LABELS[type] || type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-1 flex-shrink-0 ml-auto"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]"
            title={fullscreen ? 'Restore' : 'Fullscreen'}
          >
            {fullscreen ? <Shrink className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setOutputVisible(false)}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]"
            title="Hide panel"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {currentTab ? (
          <ArtifactTabContent tab={currentTab} artifacts={artifacts} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-[var(--app-text-tertiary)]">
            No tabs open — click + to add one
          </div>
        )}
      </div>
    </div>
  )
}

function ArtifactTabContent({ tab, artifacts }: { tab: OutputTab; artifacts: import('../../../shared/types/Artifact').Artifact[] }) {
  // Try to find matching artifact by ID first, then by type
  const artifact =
    artifacts.find((a) => a.id === tab.id) ||
    artifacts.filter((a) => a.type === tab.type).pop()

  const registration = getRenderer(tab.type)

  if (registration && artifact) {
    const Renderer = registration.component
    return <Renderer artifactId={artifact.id} content={artifact.content} title={artifact.title} editable={artifact.editable} />
  }

  if (artifact) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-[var(--app-text-primary)] mb-2">{artifact.title}</h2>
        <pre className="text-xs text-[var(--app-text-secondary)] whitespace-pre-wrap font-mono">{artifact.content.slice(0, 2000)}</pre>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center text-sm text-[var(--app-text-tertiary)]">
      <div className="text-center">
        <div className="text-2xl mb-2">{TYPE_ICONS[tab.type] || '📄'}</div>
        <div>{tab.label}</div>
        {!getRenderer(tab.type) && (
          <div className="text-xs mt-1 opacity-50">No renderer available</div>
        )}
      </div>
    </div>
  )
}
