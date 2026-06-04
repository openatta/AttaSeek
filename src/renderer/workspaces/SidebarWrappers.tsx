/**
 * Sidebar wrappers — self-contained sidebar components with internal selection state.
 *
 * These exist because sidebar components need selection state that was previously
 * managed by workspace components. Each wrapper is self-contained via useState.
 */

import { useState } from 'react'
import AutomationSidebar from './AutomationSidebar'
import PluginSidebarComponent from './PluginSidebar'
import ProjectsSidebarComponent from './ProjectsSidebar'
import type { ProjectItem } from './mock/projects'
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
  const [projectId, setProjectId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  return (
    <ProjectsSidebarComponent
      selectedProject={null}
      selectedSessionId={sessionId}
      onSelectProject={(project: ProjectItem) => {
        setProjectId(project.id)
        setSessionId(null)
      }}
      onSelectSession={(_pid: string, sid: string) => setSessionId(sid)}
      onBackToProjects={() => {
        setProjectId(null)
        setSessionId(null)
      }}
    />
  )
}
