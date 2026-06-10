/**
 * Sidebar wrappers — self-contained sidebar components with internal selection state.
 *
 * These exist because sidebar components need selection state that was previously
 * managed by workspace components. Each wrapper is self-contained via useState.
 */

import { useState } from 'react'
import { useSetAtom } from 'jotai'
import { selectedProjectIdAtom, sessionTitleStoreAtom } from '../atoms/sessionAtom'
import AutomationSidebar from './AutomationSidebar'
import PluginSidebarComponent from './PluginSidebar'
import ProjectsSidebarComponent from './ProjectsSidebar'
import type { PluginItem } from './mock/plugins'

export function AutomationSidebarConnected() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return <AutomationSidebar selectedId={selectedId} onSelect={setSelectedId} />
}

export function PluginSidebarConnected() {
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null)
  return (
    <PluginSidebarComponent
      selectedPluginId={selectedPluginId}
      onSelectPlugin={(plugin: PluginItem) => setSelectedPluginId(plugin.id)}
    />
  )
}

export function ProjectsSidebarConnected() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const setSessionTitle = useSetAtom(sessionTitleStoreAtom)

  const handleSelectSession = (projectId: string, sid: string) => {
    setSessionId(sid)
    // Set a friendly initial title — the SessionTitleGenerated event will
    // overwrite this once the first stream chunk arrives.
    setSessionTitle((prev) => ({ ...prev, [sid]: `Session ${sid.slice(0, 6)}` }))
  }

  return (
    <ProjectsSidebarComponent
      selectedSessionId={sessionId}
      onSelectSession={handleSelectSession}
    />
  )
}
