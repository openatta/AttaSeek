import { useEffect, useCallback, useRef } from 'react'
import { useDragResize } from '../hooks/useDragResize'
import { useAtomValue, useAtom, useSetAtom } from 'jotai'
import { activeActivityAtom, type Activity } from '../atoms/activityAtom'
import { sidebarWidthAtom, artifactStateByActivityAtom, getArtifactSnapshot } from '../atoms/shellAtom'
import type { ArtifactSnapshot } from '../atoms/shellAtom'
import { outputAreaVisibleAtom, outputTabsAtom, outputFullscreenAtom, activeOutputTabAtom } from '../atoms/outputTabsAtom'
import { initializeRegistries } from '../registries/init'
import ActivityBar from '../components/ActivityBar/ActivityBar'
import SidebarSlot from './SidebarSlot'
import AppSpace from './AppSpace'
import ArtifactPane from '../components/Artifact/ArtifactPane'
import WorkspaceRouter from './WorkspaceRouter'

export default function Shell() {
  const activeActivity = useAtomValue(activeActivityAtom)
  const setActiveActivity = useSetAtom(activeActivityAtom)
  const outputVisible = useAtomValue(outputAreaVisibleAtom)
  const fullscreen = useAtomValue(outputFullscreenAtom)
  const tabs = useAtomValue(outputTabsAtom)
  const activeTab = useAtomValue(activeOutputTabAtom)
  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom)
  const setOutputVisible = useSetAtom(outputAreaVisibleAtom)
  const setOutputTabs = useSetAtom(outputTabsAtom)
  const setActiveTab = useSetAtom(activeOutputTabAtom)
  const setFullscreen = useSetAtom(outputFullscreenAtom)
  const [artifactState, setArtifactState] = useAtom(artifactStateByActivityAtom)
  const prevActivityRef = useRef(activeActivity)
  const restoredRef = useRef(false)

  useEffect(() => { initializeRegistries() }, [])

  // Restore last activity on startup
  useEffect(() => {
    if (!window.api?.app) {
      restoredRef.current = true
      return
    }
    ;(async () => {
      try {
        const result = await window.api.app.getState('lastActivity')
        if (result.success && result.value) {
          setActiveActivity(result.value as Activity)
        }
      } catch { /* ignore */ }
      finally { restoredRef.current = true }
    })()
  }, [])

  // Persist current activity on change — skipped until initial restore completes
  useEffect(() => {
    if (!restoredRef.current) return
    window.api?.app?.setState('lastActivity', activeActivity).catch(() => {})
  }, [activeActivity])

  // Save/restore artifact state when switching activities
  useEffect(() => {
    const prev = prevActivityRef.current
    if (prev === activeActivity) return

    // 1. Save CURRENT state for the activity we're LEAVING (before restore overwrites it)
    const leavingSnapshot: ArtifactSnapshot = { visible: outputVisible, tabs, activeTab, fullscreen }
    setArtifactState((s) => ({ ...s, [prev]: leavingSnapshot }))

    // 2. Restore saved state for the activity we're ENTERING
    const restored = getArtifactSnapshot(artifactState, activeActivity)
    setOutputVisible(restored.visible)
    setOutputTabs(restored.tabs)
    setActiveTab(restored.activeTab)
    setFullscreen(restored.fullscreen)

    prevActivityRef.current = activeActivity
  }, [activeActivity])

  const onSidebarResize = useDragResize(setSidebarWidth, { min: 160, max: 500 })

  const showArtifact = outputVisible && activeActivity !== 'settings'

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <ActivityBar />
      <SidebarSlot />

      <div
        onMouseDown={onSidebarResize}
        className="w-[5px] -ml-[4px] flex-shrink-0 cursor-col-resize hover:bg-[var(--app-accent)]/30 transition-colors z-10"
      />

      <AppSpace
        fullscreen={fullscreen}
        agentPane={<WorkspaceRouter activity={activeActivity} />}
        artifactPane={showArtifact ? <ArtifactPane /> : null}
      />
    </div>
  )
}
