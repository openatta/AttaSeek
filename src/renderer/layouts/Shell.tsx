import { useEffect, useCallback, useRef } from 'react'
import { useAtomValue, useAtom, useSetAtom } from 'jotai'
import { activeActivityAtom } from '../atoms/activityAtom'
import { LAYOUT_MODE, sidebarWidthAtom, artifactStateByActivityAtom, getArtifactSnapshot } from '../atoms/shellAtom'
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
  const draggingRef = useRef(false)

  useEffect(() => { initializeRegistries() }, [])

  // Save/restore artifact state when switching activities
  useEffect(() => {
    const prev = prevActivityRef.current
    if (prev === activeActivity) return

    // 1. Restore saved state for the activity we're entering
    const restored = getArtifactSnapshot(artifactState, activeActivity)
    setOutputVisible(restored.visible)
    setOutputTabs(restored.tabs)
    setActiveTab(restored.activeTab)
    setFullscreen(restored.fullscreen)

    // 2. Save current state for the activity we're leaving
    const snapshot: ArtifactSnapshot = { visible: outputVisible, tabs, activeTab, fullscreen }
    setArtifactState((s) => ({ ...s, [prev]: snapshot }))

    prevActivityRef.current = activeActivity
  }, [activeActivity])

  const onSidebarResize = useCallback(() => {
    draggingRef.current = true
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      setSidebarWidth((w) => Math.min(500, Math.max(160, w + e.movementX)))
    }
    const onUp = () => {
      draggingRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [setSidebarWidth])

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
        mode={LAYOUT_MODE}
        fullscreen={fullscreen}
        agentPane={<WorkspaceRouter activity={activeActivity} />}
        artifactPane={showArtifact ? <ArtifactPane /> : null}
      />
    </div>
  )
}
