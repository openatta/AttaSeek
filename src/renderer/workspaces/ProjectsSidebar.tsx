/**
 * ProjectsSidebar — project list + per-project session tree.
 *
 * Level 1: list of all projects. Click to select/activate.
 * Level 2 (when project selected): sessions for that project.
 *
 * Replaces the old mock-based implementation with real IPC calls.
 */

import { useState, useCallback, useEffect } from 'react'
import { useAtom } from 'jotai'
import { Plus, Trash2 } from 'lucide-react'
import { projectsAtom, selectedProjectIdAtom } from '../atoms/sessionAtom'
import { apContextAtom, projectRootAtom } from '../components/Artifact/ApAtoms'
import { getApi } from '../utils/api'
import type { ProjectInfo } from '../../shared/types/ipc'
import type { SessionInfo } from '../../shared/types/AgentTask'
import ProjectCreateDialog from '../components/Project/ProjectCreateDialog'

interface Props {
  selectedSessionId: string | null
  onSelectSession: (projectId: string, sessionId: string) => void
}

export default function ProjectsSidebar({ selectedSessionId, onSelectSession }: Props) {
  const [projects, setProjects] = useAtom(projectsAtom)
  const [selectedProjectId, setSelectedProjectId] = useAtom(selectedProjectIdAtom)
  const [, setProjectRoot] = useAtom(projectRootAtom)
  const [, setApContext] = useAtom(apContextAtom)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [projectSessions, setProjectSessions] = useState<Record<string, SessionInfo[]>>({})
  const [contextMenu, setContextMenu] = useState<{ projectId: string; x: number; y: number } | null>(null)

  // Load projects on mount
  useEffect(() => {
    const api = getApi()
    api.project.list().then((r) => {
      if (r.success && r.projects) setProjects(r.projects)
    }).catch((err) => { console.warn('[ProjectsSidebar] failed to load projects:', err) })
  }, [setProjects])

  // Load sessions for selected project
  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null

  useEffect(() => {
    if (!selectedProjectId) return
    const api = getApi()
    api.session.list(undefined, selectedProjectId).then((r) => {
      if (r.success && r.sessions) {
        setProjectSessions((prev) => ({ ...prev, [selectedProjectId]: r.sessions }))
      }
    }).catch((err) => { console.warn('[ProjectsSidebar] failed to load sessions:', err) })
  }, [selectedProjectId])

  // Activate project context
  const activateProject = useCallback((project: ProjectInfo) => {
    setSelectedProjectId(project.id)
    setProjectRoot(project.rootPath)
    setApContext('project')
  }, [setSelectedProjectId, setProjectRoot, setApContext])

  // Create new session in selected project
  const handleCreateSession = useCallback(async () => {
    if (!selectedProjectId) return
    const api = getApi()
    const result = await api.session.create('New Session', 'projects', undefined, selectedProjectId)
    if (result.session) {
      setProjectSessions((prev) => {
        const existing = prev[selectedProjectId] || []
        return { ...prev, [selectedProjectId]: [result.session!, ...existing] }
      })
    }
  }, [selectedProjectId])

  // Remove project
  const handleRemoveProject = useCallback(async (projectId: string) => {
    if (!confirm('确定要移除此项目吗？该项目下的会话记录将被删除。此操作不可撤销。')) return
    const api = getApi()
    const result = await api.project.remove(projectId)
    if (result.success) {
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null)
        setProjectRoot(null)
        setApContext('chats')
      }
    }
    setContextMenu(null)
  }, [selectedProjectId, setProjects, setSelectedProjectId, setProjectRoot, setApContext])

  const sessions = selectedProjectId ? (projectSessions[selectedProjectId] || []) : []

  return (
    <div className="flex flex-col h-full">
      {/* Title row */}
      <div className="flex items-center px-4 pb-2">
        <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
          PROJECTS
        </h2>
        <div className="flex-1" />
        {selectedProjectId && (
          <button
            onClick={handleCreateSession}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
            title="New session in project"
            aria-label="New Project Session"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => setDialogOpen(true)}
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors ml-1"
          title="New Project"
          aria-label="New Project"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="px-4 py-6 text-xs text-[var(--app-text-tertiary)] text-center">
            No projects yet.
            <button onClick={() => setDialogOpen(true)} className="block mt-1 text-[var(--app-accent)] hover:underline">Create one</button>
          </div>
        ) : (
          <div className="px-2">
            {projects.map((project) => (
              <div key={project.id}>
                <button
                  onClick={() => activateProject(project)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ projectId: project.id, x: e.clientX, y: e.clientY })
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded text-xs transition-colors text-left ${
                    selectedProjectId === project.id
                      ? 'bg-[var(--app-bg-active)] text-[var(--app-text)]'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]'
                  }`}
                >
                  <span className="text-[10px]">{selectedProjectId === project.id ? '●' : '○'}</span>
                  <span className="flex-1 truncate">{project.name}</span>
                  <span className="text-[10px] text-[var(--app-text-dim)]">
                    {(projectSessions[project.id] || []).length}
                  </span>
                </button>

                {/* Sessions under this project (only for selected project) */}
                {selectedProjectId === project.id && (
                  <div className="ml-4">
                    {sessions.length === 0 ? (
                      <div className="px-2 py-3 text-[10px] text-[var(--app-text-tertiary)] text-center">
                        No sessions
                      </div>
                    ) : (
                      sessions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => onSelectSession(project.id, s.id)}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors truncate ${
                            selectedSessionId === s.id
                              ? 'bg-[var(--app-bg-active)] text-[var(--app-text)]'
                              : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]'
                          }`}
                        >
                          {s.title}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 w-36 bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handleRemoveProject(contextMenu.projectId)}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-error)] hover:bg-[var(--app-bg-hover)] flex items-center gap-2"
            >
              <Trash2 className="w-3 h-3" /> 移除
            </button>
          </div>
        </>
      )}

      {/* Create project dialog */}
      <ProjectCreateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => {
          // Reload project list
          getApi().project.list().then((r) => {
            if (r.success && r.projects) setProjects(r.projects)
          }).catch(() => {})
        }}
      />
    </div>
  )
}
