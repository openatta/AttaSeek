/**
 * Sidebar wrappers — self-contained sidebar components with internal selection state.
 *
 * These exist because sidebar components need selection state that was previously
 * managed by workspace components. Each wrapper is self-contained via useState.
 */

import { useState, useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { selectedProjectIdAtom } from '../atoms/sessionAtom'
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
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const setSelectedProjectId = useSetAtom(selectedProjectIdAtom)

  useEffect(() => { setSelectedProjectId(selectedProject?.id || null) }, [selectedProject])

  return (
    <ProjectsSidebarComponent
      selectedProject={selectedProject}
      selectedSessionId={sessionId}
      onSelectProject={(project: ProjectItem) => {
        setSelectedProject(project)
        setSessionId(null)
        setSelectedProjectId(project.id)
      }}
      onSelectSession={(_pid: string, sid: string) => setSessionId(sid)}
      onBackToProjects={() => {
        setSelectedProject(null)
        setSessionId(null)
      }}
    />
  )
}
