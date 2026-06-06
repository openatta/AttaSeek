import { useEffect, useRef } from 'react'
import { useAtomValue, useAtom, useSetAtom } from 'jotai'
import { activeActivityAtom } from '../atoms/activityAtom'
import {
  artifactStateByActivityAtom,
  getArtifactSnapshot,
  type ArtifactSnapshot,
} from '../atoms/shellAtom'
import {
  outputAreaVisibleAtom,
  outputTabsAtom,
  outputFullscreenAtom,
  activeOutputTabAtom,
} from '../atoms/outputTabsAtom'

/**
 * Saves artifact pane state when leaving an activity and restores persisted
 * state when entering a new one. Keeps each activity's terminal/output panel
 * layout independent.
 */
export function useArtifactActivitySwitch(): void {
  const activeActivity = useAtomValue(activeActivityAtom)
  const outputVisible = useAtomValue(outputAreaVisibleAtom)
  const tabs = useAtomValue(outputTabsAtom)
  const activeTab = useAtomValue(activeOutputTabAtom)
  const fullscreen = useAtomValue(outputFullscreenAtom)
  const [artifactState, setArtifactState] = useAtom(artifactStateByActivityAtom)
  const setOutputVisible = useSetAtom(outputAreaVisibleAtom)
  const setOutputTabs = useSetAtom(outputTabsAtom)
  const setActiveTab = useSetAtom(activeOutputTabAtom)
  const setFullscreen = useSetAtom(outputFullscreenAtom)
  const prevActivityRef = useRef(activeActivity)

  useEffect(() => {
    const prev = prevActivityRef.current
    if (prev === activeActivity) return

    // 1. Save CURRENT state for the activity we're LEAVING
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
}
