/**
 * ApTabBar — AP title bar with Tab list, [+] add button, overflow scroll,
 * and right-side controls (zoom toggle + show/hide toggle).
 *
 * Layout: [Tab1] [Tab2] … [+] [<] [>]          [zoom] [show/hide]
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Plus, ChevronLeft, ChevronRight, Expand, Shrink, PanelRightClose } from 'lucide-react'
import { apTabsAtom, activeApTabAtom, apVisibleAtom, apFullscreenAtom } from './ApAtoms'
import { listPanes, type PaneType } from './PaneRegistry'
import { useAvailablePanes } from '../../hooks/useAvailablePanes'
import { useAddTab } from '../../hooks/useAddTab'
import type { ApTab } from './ApAtoms'

export default function ApTabBar() {
  const [tabs, setTabs] = useAtom(apTabsAtom)
  const [activeTab, setActiveTab] = useAtom(activeApTabAtom)
  const [fullscreen, setFullscreen] = useAtom(apFullscreenAtom)
  const [, setApVisible] = useAtom(apVisibleAtom)

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [showLeftScroll, setShowLeftScroll] = useState(false)
  const [showRightScroll, setShowRightScroll] = useState(false)
  const tabListRef = useRef<HTMLDivElement>(null)

  const availablePanes = useAvailablePanes()
  const addTab = useAddTab()

  // Resolve icon from registry rather than a hardcoded map
  const getPaneIcon = useCallback((paneType: string) => {
    const reg = listPanes().find((p) => p.type === paneType)
    return reg?.icon || '📄'
  }, [])

  const checkScroll = useCallback(() => {
    const el = tabListRef.current
    if (!el) return
    setShowLeftScroll(el.scrollLeft > 1)
    setShowRightScroll(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = tabListRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    return () => el.removeEventListener('scroll', checkScroll)
  }, [checkScroll, tabs])

  const handleAddTab = (paneType: PaneType) => {
    addTab(paneType)
    setAddMenuOpen(false)
  }

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newTabs = tabs.filter((t) => t.id !== tabId)
    setTabs(newTabs)
    if (activeTab === tabId) {
      if (newTabs.length > 0) {
        const idx = tabs.findIndex((t) => t.id === tabId)
        const nextIdx = Math.min(idx, newTabs.length - 1)
        setActiveTab(newTabs[nextIdx].id)
      } else {
        setActiveTab(null)
      }
    }
  }

  const scrollLeft = () => {
    tabListRef.current?.scrollBy({ left: -150, behavior: 'smooth' })
  }
  const scrollRight = () => {
    tabListRef.current?.scrollBy({ left: 150, behavior: 'smooth' })
  }

  return (
    <div
      className="flex items-center h-[40px] pl-2 border-b border-[var(--app-border)] flex-shrink-0 gap-1 relative"
      style={{ WebkitAppRegion: 'drag', paddingRight: '84px' } as React.CSSProperties}
    >
      {/* ── Tab area (scrollable, takes remaining space) ── */}
      <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-hidden">
        {showLeftScroll && (
          <button
            onClick={scrollLeft}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}

        <div
          ref={tabListRef}
          className="flex items-center gap-0.5 overflow-hidden flex-1 min-w-0"
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className={`group flex items-center gap-1 px-2.5 py-1 text-xs rounded cursor-pointer transition-colors whitespace-nowrap select-none flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[var(--app-bg-primary)] text-[var(--app-text-primary)]'
                  : 'text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]'
              }`}
            >
              <span className="text-xs">{getPaneIcon(tab.paneType)}</span>
              <span>{tab.label}</span>
              <button
                onClick={(e) => closeTab(tab.id, e)}
                className="flex-shrink-0 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-[var(--app-bg-hover)] transition-opacity"
                title="Close tab"
              >
                <span className="text-[10px] leading-none px-0.5">✕</span>
              </button>
            </div>
          ))}
        </div>

        {showRightScroll && (
          <button
            onClick={scrollRight}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* ── Right controls: absolutely positioned at the right edge.
           Always visible regardless of panel width or fullscreen state. ── */}
      <div
        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* [+] Add button — opens upward to avoid webview z-index occlusion */}
        <div className="relative">
          <button
            onClick={() => setAddMenuOpen(!addMenuOpen)}
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors"
            title="Add pane"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          {addMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
              <div className="absolute bottom-full right-0 mb-1 w-40 bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg z-50 py-1">
                {availablePanes.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[var(--app-text-tertiary)]">No available panes</div>
                ) : (
                  availablePanes.map((p) => (
                    <button
                      key={p.type}
                      onClick={() => handleAddTab(p.type)}
                      className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors flex items-center gap-2"
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Zoom toggle */}
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]"
          title={fullscreen ? 'Restore size' : 'Maximize'}
        >
          {fullscreen ? <Shrink className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
        </button>

        {/* Show/hide toggle */}
        <button
          onClick={() => setApVisible(false)}
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]"
          title="Hide panel"
        >
          <PanelRightClose className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
