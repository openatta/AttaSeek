/**
 * useProjectData — data-fetching hooks for the ProjectsSidebar.
 *
 * Extracts project list loading, session loading per project, and
 * directory validation from the sidebar component into reusable hooks.
 */

import { useState, useEffect } from 'react'
import { getApi } from '../utils/api'
import type { ProjectInfo } from '../../shared/types/ipc'
import type { SessionInfo } from '../../shared/types/AgentTask'

/** Load the full project list on mount. */
export function useProjectList(
  setProjects: (updater: ProjectInfo[] | ((prev: ProjectInfo[]) => ProjectInfo[])) => void,
): void {
  useEffect(() => {
    const api = getApi()
    api.project.list().then((r) => {
      if (r.success && r.projects) setProjects(r.projects)
    }).catch((err) => { console.warn('[ProjectsSidebar] failed to load projects:', err) })
  }, [setProjects])
}

/** Load sessions for a given project, with cancellation. */
export function useProjectSessions(
  projectId: string | null,
): [Record<string, SessionInfo[]>, React.Dispatch<React.SetStateAction<Record<string, SessionInfo[]>>>] {
  const [projectSessions, setProjectSessions] = useState<Record<string, SessionInfo[]>>({})

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    const api = getApi()
    api.session.list(undefined, projectId).then((r) => {
      if (cancelled) return
      if (r.success && r.sessions) {
        setProjectSessions((prev) => ({ ...prev, [projectId]: r.sessions }))
      }
    }).catch((err) => { if (!cancelled) console.warn('[ProjectsSidebar] failed to load sessions:', err) })
    return () => { cancelled = true }
  }, [projectId])

  return [projectSessions, setProjectSessions]
}

/** Validate that the selected project's directory still exists. */
export function useProjectDirectoryValidation(
  selectedProjectId: string | null,
  projects: ProjectInfo[],
): string | null {
  const [missingDirProjectId, setMissingDirProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedProjectId) { setMissingDirProjectId(null); return }
    const project = projects.find((p) => p.id === selectedProjectId)
    if (!project) return
    const api = getApi()
    api.project.validate(project.rootPath).then((r) => {
      if (r.success && !r.valid) {
        setMissingDirProjectId(project.id)
      } else {
        setMissingDirProjectId(null)
      }
    }).catch(() => { setMissingDirProjectId(null) })
  }, [selectedProjectId, projects])

  return missingDirProjectId
}
