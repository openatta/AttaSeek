/**
 * ProjectsSidebar — project list + per-project session tree.
 *
 * Layout:
 *   PROJECTS                        [+]
 *   ───────────────────────────────────
 *   ● ProjectA  (3)  [+]  [⋯]         ← row buttons on selected project
 *     └─ Debug API crash
 *     └─ Refactor auth module
 *   ○ ProjectB  (0)
 *   ○ ProjectC  (1)
 *
 * Session creation uses temp IDs (like CHATS) — only appears in
 * sidebar when the first message is sent and SessionTitleGenerated fires.
 */

import { useState, useCallback, useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { Plus, MoreVertical, Trash2 } from 'lucide-react'
import { projectsAtom, selectedProjectIdAtom, currentSessionIdAtom, sessionEventsAtom } from '../atoms/sessionAtom'
import { apContextAtom, apVisibleAtom, projectRootAtom } from '../components/Artifact/ApAtoms'
import { createTempSessionId } from '../../shared/constants'
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
  const [, setApVisible] = useAtom(apVisibleAtom)
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom)
  const setSessionEvents = useSetAtom(sessionEventsAtom)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [projectSessions, setProjectSessions] = useState<Record<string, SessionInfo[]>>({})
  const [projectMenu, setProjectMenu] = useState<{ projectId: string; x: number; y: number } | null>(null)
  const [missingDirProjectId, setMissingDirProjectId] = useState<string | null>(null)

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
    let cancelled = false
    const projectId = selectedProjectId
    const api = getApi()
    api.session.list(undefined, projectId).then((r) => {
      if (cancelled) return
      if (r.success && r.sessions) {
        setProjectSessions((prev) => ({ ...prev, [projectId]: r.sessions }))
      }
    }).catch((err) => { if (!cancelled) console.warn('[ProjectsSidebar] failed to load sessions:', err) })
    return () => { cancelled = true }
  }, [selectedProjectId])

  // Validate selected project's directory still exists
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

  // Activate project context
  const activateProject = useCallback((project: ProjectInfo) => {
    setSelectedProjectId(project.id)
    setProjectRoot(project.rootPath)
    setApContext('project')
  }, [setSelectedProjectId, setProjectRoot, setApContext])

  // Create new session (temp ID — like CHATS, only persists on first message)
  const handleCreateSession = useCallback((projectId: string) => {
    const tempId = createTempSessionId()
    setCurrentSessionId(tempId)
    setSessionEvents([])
  }, [setCurrentSessionId, setSessionEvents])

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
        setApVisible(false)
      }
    }
    setProjectMenu(null)
  }, [selectedProjectId, setProjects, setSelectedProjectId, setProjectRoot, setApContext, setApVisible])

  // Subscribe to session updates (new sessions appear when first message is sent)
  useEffect(() => {
    const api = getApi()
    const unsubscribe = api.session.onUpdate((data: { id: string; title: string }) => {
      // Refresh sessions for current project when a session gets its first title
      if (selectedProjectId) {
        api.session.list(undefined, selectedProjectId).then((r) => {
          if (r.success && r.sessions) {
            setProjectSessions((prev) => ({ ...prev, [selectedProjectId]: r.sessions }))
          }
        }).catch(() => {})
      }
    })
    return unsubscribe
  }, [selectedProjectId])

  const sessions = selectedProjectId ? (projectSessions[selectedProjectId] || []) : []

  return (
    <div className="flex flex-col h-full">
      {/* Title row — only one [+] for adding projects */}
      <div className="flex items-center px-4 pb-2">
        <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
          PROJECTS
        </h2>
        <div className="flex-1" />
        <button
          onClick={() => setDialogOpen(true)}
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
          title="New Project"
          aria-label="New Project"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Missing directory warning */}
      {missingDirProjectId && selectedProject && (
        <div className="px-4 pb-2">
          <div className="text-[10px] text-[var(--app-warning)] bg-[var(--app-warning-bg)] border border-[var(--app-warning-border)] rounded px-2 py-1.5">
            项目目录不存在或无法访问
            <button
              onClick={() => handleRemoveProject(missingDirProjectId)}
              className="ml-2 text-[var(--app-error)] hover:underline"
            >
              移除项目
            </button>
          </div>
        </div>
      )}

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
                {/* Project row */}
                <div
                  className={`group flex items-center gap-2 px-2 py-2 rounded text-xs transition-colors ${
                    selectedProjectId === project.id
                      ? 'bg-[var(--app-bg-active)] text-[var(--app-text)]'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]'
                  }`}
                >
                  <button
                    onClick={() => activateProject(project)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <span className="text-[10px] flex-shrink-0">{selectedProjectId === project.id ? '●' : '○'}</span>
                    <span className="flex-1 truncate">{project.name}</span>
                    <span className="text-[10px] text-[var(--app-text-dim)] flex-shrink-0">
                      {(projectSessions[project.id] || []).length}
                    </span>
                  </button>

                  {/* Row actions (visible on selected project) */}
                  {selectedProjectId === project.id && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCreateSession(project.id) }}
                        className="w-5 h-5 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
                        title="New session"
                        aria-label="New Project Session"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const rect = (e.target as HTMLElement).getBoundingClientRect()
                          setProjectMenu({ projectId: project.id, x: rect.left, y: rect.bottom + 4 })
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
                        title="Project menu"
                        aria-label="Project menu"
                      >
                        <MoreVertical className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

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

      {/* Project menu dropdown (⋯) */}
      {projectMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setProjectMenu(null)} />
          <div
            className="fixed z-50 w-40 bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg py-1"
            style={{ left: projectMenu.x, top: projectMenu.y }}
          >
            <button
              onClick={() => handleRemoveProject(projectMenu.projectId)}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-error)] hover:bg-[var(--app-bg-hover)] flex items-center gap-2"
            >
              <Trash2 className="w-3 h-3" /> 删除项目
            </button>
          </div>
        </>
      )}

      {/* Create project dialog */}
      <ProjectCreateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => {
          getApi().project.list().then((r) => {
            if (r.success && r.projects) setProjects(r.projects)
          }).catch(() => {})
        }}
      />
    </div>
  )
}
