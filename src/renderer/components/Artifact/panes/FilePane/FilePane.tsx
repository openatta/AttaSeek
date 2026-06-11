/**
 * FilePane — single-instance file viewer with internal file tabs.
 *
 * Layout:
 *   [internal file tabs] [explorer toggle]   ← replaces old FileSubHeader
 *   ┌──────────────────────┬────────────────┐
 *   │  FilePreviewArea     │ FileExplorer   │
 *   │  (unified viewer)    │ (toggleable)   │
 *   └──────────────────────┴────────────────┘
 *
 * Single-instance: only one FilePane AP tab. Internal tabs for open files.
 * FileSubHeader deleted — path bar removed, tab bar takes its place.
 */

import { useState, useCallback, useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { projectRootAtom } from '../../ApAtoms'
import { X, PanelRightClose, PanelRightOpen } from 'lucide-react'
import type { PaneProps } from '../../PaneRegistry'
import { getMimeType } from '../../../../../shared/types/mime'
import FileExplorer from './FileExplorer'
import FilePreviewArea from './FilePreviewArea'

interface FileTab {
  id: string
  path: string
  name: string
  mime?: string
}

export default function FilePane(_props: PaneProps) {
  const projectRoot = useAtomValue(projectRootAtom)
  const rootPath = projectRoot || ''

  const [explorerVisible, setExplorerVisible] = useState(true)
  const [openTabs, setOpenTabs] = useState<FileTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  const activeTab = useMemo(
    () => openTabs.find((t) => t.id === activeTabId) || null,
    [openTabs, activeTabId],
  )

  const openFile = useCallback((filePath: string) => {
    const existing = openTabs.find((t) => t.path === filePath)
    if (existing) {
      setActiveTabId(existing.id)
      return
    }

    const name = filePath.split('/').pop() || filePath
    const mime = getMimeType(filePath)
    const id = `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    setOpenTabs((prev) => [...prev, { id, path: filePath, name, mime }])
    setActiveTabId(id)
  }, [openTabs])

  const closeTab = useCallback((tabId: string) => {
    setOpenTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== tabId)
      if (activeTabId === tabId && filtered.length > 0) {
        const idx = prev.findIndex((t) => t.id === tabId)
        const nextIdx = Math.min(idx, filtered.length - 1)
        setActiveTabId(filtered[nextIdx].id)
      } else if (filtered.length === 0) {
        setActiveTabId(null)
      }
      return filtered
    })
  }, [activeTabId])

  return (
    <div className="flex flex-col h-full">
      {/* Internal file tab bar (replaces old FileSubHeader) */}
      <div className="flex items-center h-[28px] border-b border-[var(--app-border)] flex-shrink-0 bg-[var(--app-bg-secondary)]">
        {/* File tabs */}
        <div className="flex items-center gap-0 overflow-hidden flex-1 min-w-0">
          {openTabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group flex items-center gap-1 px-2.5 py-0.5 text-xs cursor-pointer whitespace-nowrap flex-shrink-0 border-r border-[var(--app-border)] transition-colors ${
                tab.id === activeTabId
                  ? 'bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] border-t border-[var(--app-accent)]'
                  : 'text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]'
              }`}
            >
              <span className="max-w-[160px] truncate">{tab.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                className="rounded-sm opacity-0 group-hover:opacity-100 hover:bg-[var(--app-bg-hover)] transition-opacity flex-shrink-0"
                aria-label={`Close ${tab.name}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          {openTabs.length === 0 && (
            <span className="px-2 text-[10px] text-[var(--app-text-tertiary)]">No open files</span>
          )}
        </div>

        {/* Explorer toggle (right side) */}
        <button
          onClick={() => setExplorerVisible(!explorerVisible)}
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors flex-shrink-0"
          title={explorerVisible ? 'Hide Explorer' : 'Show Explorer'}
        >
          {explorerVisible ? (
            <PanelRightClose className="w-3 h-3" />
          ) : (
            <PanelRightOpen className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* File viewer (left) */}
        <div className="flex-1 min-w-0 border-r border-[var(--app-border)]">
          {activeTab ? (
            <FilePreviewArea filePath={activeTab.path} mime={activeTab.mime} />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-[var(--app-text-tertiary)]">
              Select a file to view
            </div>
          )}
        </div>

        {/* File Explorer (right, toggleable) */}
        {explorerVisible && (
          <div className="w-[240px] flex-shrink-0 overflow-hidden flex flex-col">
            <FileExplorer
              rootPath={rootPath}
              activeFilePath={activeTab?.path || null}
              onFileClick={openFile}
            />
          </div>
        )}
      </div>
    </div>
  )
}
