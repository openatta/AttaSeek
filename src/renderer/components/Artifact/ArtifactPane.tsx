/**
 * ArtifactPane — full artifact display, editing, and review area.
 * Shell-owned panel rendered in AppSpace's right slot.
 */

import { useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { outputTabsAtom, activeOutputTabAtom, outputAreaVisibleAtom, outputFullscreenAtom } from '../../atoms/outputTabsAtom'
import { artifactsAtom } from '../../atoms/sessionAtom'
import { getRenderer } from '../../registries/artifactRendererRegistry'
import { PanelRightClose, Expand, Shrink, Plus, X } from 'lucide-react'
import type { OutputTab, OutputTabType } from '../../atoms/outputTabsAtom'

const TYPE_ICONS: Record<string, string> = {
  browser: '🌐', files: '📁', terminal: '⬛', review: '📝',
  markdown: '📄', html: '🌐', svg: '🖼', table: '📊',
  code: '⌨', diff: '🔍',
}

const ADD_TAB_OPTIONS: { type: OutputTabType; label: string }[] = [
  { type: 'files', label: 'Files' },
  { type: 'terminal', label: 'Terminal' },
  { type: 'browser', label: 'Browser' },
  { type: 'review', label: 'Review' },
]

export default function ArtifactPane() {
  const [tabs, setTabs] = useAtom(outputTabsAtom)
  const [activeTab, setActiveTab] = useAtom(activeOutputTabAtom)
  const visible = useAtomValue(outputAreaVisibleAtom)
  const [fullscreen, setFullscreen] = useAtom(outputFullscreenAtom)
  const [, setOutputVisible] = useAtom(outputAreaVisibleAtom)
  const artifacts = useAtomValue(artifactsAtom)
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  if (!visible) return null

  const currentTab = tabs.find((t) => t.id === activeTab)

  const addTab = (type: OutputTabType) => {
    const id = `tab-${Date.now()}`
    const label = ADD_TAB_OPTIONS.find((o) => o.type === type)?.label || type
    setTabs((prev) => [...prev, { id, type, label }])
    setActiveTab(id)
    setAddMenuOpen(false)
  }

  const closeTab = (tabId: string) => {
    const newTabs = tabs.filter((t) => t.id !== tabId)
    setTabs(newTabs)
    if (activeTab === tabId && newTabs.length > 0) setActiveTab(newTabs[newTabs.length - 1].id)
  }

  return (
    <div className="flex flex-col flex-1 bg-[var(--app-bg-secondary)]">
      {/* Header bar — height matches SessionHeader (40px), draggable */}
      <div
        className="flex items-center h-[40px] px-2 border-b border-[var(--app-border)] flex-shrink-0 gap-1"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Tabs — Codex style: × icon label */}
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
              {/* Close button — left side, Codex style */}
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

          {/* + Add tab button */}
          <div className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              className="flex items-center justify-center w-6 h-6 rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors"
              title="Add tab"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {addMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-36 bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg z-50 py-1">
                {ADD_TAB_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => addTab(opt.type)}
                    className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors flex items-center gap-2"
                  >
                    <span>{TYPE_ICONS[opt.type] || '📄'}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions — always right-aligned */}
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

function ArtifactTabContent({ tab, artifacts }: { tab: OutputTab; artifacts: import('../../core/types/Artifact').Artifact[] }) {
  const artifact = artifacts.find((a) => a.id === tab.id || a.type === tab.type)
  const registration = getRenderer(tab.type)

  if (registration && artifact) {
    const Renderer = registration.component
    return <Renderer artifactId={artifact.id} content={artifact.content} title={artifact.title} editable={artifact.editable} />
  }

  if (artifact) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-[var(--app-text-primary)] mb-2">{artifact.title}</h2>
        <pre className="text-xs text-[var(--app-text-secondary)] whitespace-pre-wrap font-mono">{artifact.content.slice(0, 1000)}</pre>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center text-sm text-[var(--app-text-tertiary)]">
      <div className="text-center">
        <div className="text-2xl mb-2">{TYPE_ICONS[tab.type] || '📄'}</div>
        <div>{tab.label}</div>
      </div>
    </div>
  )
}
