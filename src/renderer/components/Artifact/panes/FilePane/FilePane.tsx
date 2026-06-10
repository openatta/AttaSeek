/**
 * FilePane — File Explorer + Multi-tab Preview area.
 *
 * Layout: [FileSubHeader] | [FilePreviewArea (left)] [FileExplorer (right, toggleable)]
 * State: all component-local (supports multiple FilePane instances via AP tabs).
 */

import { useState, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { projectRootAtom } from '../../ApAtoms'
import type { PaneProps } from '../../PaneRegistry'
import { getMimeType } from '../../../../../shared/types/mime'
import FileSubHeader from './FileSubHeader'
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

  const openFile = useCallback((filePath: string) => {
    // Check if already open
    const existing = openTabs.find((t) => t.path === filePath)
    if (existing) {
      setActiveTabId(existing.id)
      return
    }

    const name = filePath.split('/').pop() || filePath
    const mime = getMimeType(filePath) || 'text/plain'

    const newTab: FileTab = {
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      path: filePath,
      name,
      mime,
    }
    setOpenTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
  }, [openTabs])

  const closeTab = useCallback((tabId: string) => {
    const newTabs = openTabs.filter((t) => t.id !== tabId)
    setOpenTabs(newTabs)
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        const idx = openTabs.findIndex((t) => t.id === tabId)
        const nextIdx = Math.min(idx, newTabs.length - 1)
        setActiveTabId(newTabs[nextIdx].id)
      } else {
        setActiveTabId(null)
      }
    }
  }, [openTabs, activeTabId])

  return (
    <div className="flex flex-col h-full">
      <FileSubHeader
        rootPath={rootPath}
        explorerVisible={explorerVisible}
        onToggleExplorer={() => setExplorerVisible(!explorerVisible)}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Preview area (left) */}
        <div className="flex-1 min-w-0 border-r border-[var(--app-border)]">
          <FilePreviewArea
            tabs={openTabs}
            activeTabId={activeTabId}
            onTabClick={setActiveTabId}
            onTabClose={closeTab}
          />
        </div>

        {/* File Explorer (right, toggleable) */}
        {explorerVisible && (
          <div className="w-[240px] flex-shrink-0 overflow-hidden flex flex-col">
            <FileExplorer
              rootPath={rootPath}
              activeFilePath={openTabs.find((t) => t.id === activeTabId)?.path || null}
              onFileClick={openFile}
            />
          </div>
        )}
      </div>
    </div>
  )
}
