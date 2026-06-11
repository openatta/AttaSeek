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
import { apTabsAtom, activeApTabAtom, browserInstanceAtom, fileInstanceAtom, reviewInstanceAtom, apVisibleAtom, apFullscreenAtom } from './ApAtoms'
import ApTabBar from './ApTabBar'
import ApEmptyState from './ApEmptyState'
import ApPaneHost from './ApPaneHost'

export default function ApContainer() {
  const tabs = useAtomValue(apTabsAtom)
  const activeTab = useAtomValue(activeApTabAtom)
  const visible = useAtomValue(apVisibleAtom)
  const fullscreen = useAtomValue(apFullscreenAtom)
  const setHasBrowser = useSetAtom(browserInstanceAtom)
  const setHasFile = useSetAtom(fileInstanceAtom)
  const setHasReview = useSetAtom(reviewInstanceAtom)

  // Sync single-instance guard atoms when tabs change
  const hasBrowserTab = tabs.some((t) => t.paneType === 'browser')
  const hasFileTab = tabs.some((t) => t.paneType === 'file')
  const hasReviewTab = tabs.some((t) => t.paneType === 'review')
  useEffect(() => { setHasBrowser(hasBrowserTab) }, [hasBrowserTab, setHasBrowser])
  useEffect(() => { setHasFile(hasFileTab) }, [hasFileTab, setHasFile])
  useEffect(() => { setHasReview(hasReviewTab) }, [hasReviewTab, setHasReview])

  if (!visible) return null

  const currentTab = tabs.find((t) => t.id === activeTab)

  return (
    <div className={`flex flex-col bg-[var(--app-bg-secondary)] h-full ${fullscreen ? 'flex-1' : ''}`}>
      <ApTabBar />

      {/* Content area — relative for absolute panes (Terminal), flex column for flex panes (Browser/File/Review) */}
      <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
        {currentTab ? (
          <ApPaneHost tab={currentTab} />
        ) : (
          <ApEmptyState />
        )}
      </div>
    </div>
  )
}
