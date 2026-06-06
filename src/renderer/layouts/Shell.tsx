import { useEffect } from 'react'
import { useDragResize } from '../hooks/useDragResize'
import { useActivityPersistence } from '../hooks/useActivityPersistence'
import { useArtifactActivitySwitch } from '../hooks/useArtifactActivitySwitch'
import { useAtomValue, useAtom } from 'jotai'
import { activeActivityAtom } from '../atoms/activityAtom'
import { sidebarWidthAtom } from '../atoms/shellAtom'
import { outputAreaVisibleAtom, outputFullscreenAtom } from '../atoms/outputTabsAtom'
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
  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom)

  useEffect(() => { initializeRegistries() }, [])

  useActivityPersistence()
  useArtifactActivitySwitch()

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
