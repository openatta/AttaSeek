/**
 * ApContainer — Artifact Pane root component.
 *
 * Replaces the old ArtifactPane. Manages the AP Tab system:
 * - ApTabBar (title bar with tabs, + button, zoom/show-hide controls)
 * - ApEmptyState (big buttons when no tabs are open)
 * - ApPaneHost (renders the active pane component)
 *
 * Each pane type is registered via PaneRegistry and rendered independently.
 */

import { useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { apTabsAtom, activeApTabAtom, browserInstanceAtom, apVisibleAtom, apFullscreenAtom } from './ApAtoms'
import ApTabBar from './ApTabBar'
import ApEmptyState from './ApEmptyState'
import ApPaneHost from './ApPaneHost'

export default function ApContainer() {
  const tabs = useAtomValue(apTabsAtom)
  const activeTab = useAtomValue(activeApTabAtom)
  const visible = useAtomValue(apVisibleAtom)
  const fullscreen = useAtomValue(apFullscreenAtom)
  const setHasBrowser = useSetAtom(browserInstanceAtom)

  // Sync browser instance atom when tabs change (for single-instance constraint)
  const hasBrowserTab = tabs.some((t) => t.paneType === 'browser')
  useEffect(() => {
    setHasBrowser(hasBrowserTab)
  }, [hasBrowserTab, setHasBrowser])

  if (!visible) return null

  const currentTab = tabs.find((t) => t.id === activeTab)

  return (
    <div className={`flex flex-col bg-[var(--app-bg-secondary)] ${fullscreen ? 'flex-1' : ''}`}>
      <ApTabBar />

      {/* Content area — flex column so panes can use flex-1 to fill space */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {currentTab ? (
          <ApPaneHost tab={currentTab} />
        ) : (
          <ApEmptyState />
        )}
      </div>
    </div>
  )
}
