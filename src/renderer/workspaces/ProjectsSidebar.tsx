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
 *
 * Data-fetching logic is extracted to src/renderer/hooks/useProjectData.ts.
 */

import { useState, useCallback, useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { Plus, MoreVertical, Trash2 } from 'lucide-react'
import { projectsAtom, selectedProjectIdAtom, currentSessionIdAtom, sessionEventsAtom } from '../atoms/sessionAtom'
import { apContextAtom, apVisibleAtom, projectRootAtom } from '../components/Artifact/ApAtoms'
import { createTempSessionId } from '../../shared/constants'
import { getApi } from '../utils/api'
import { useTranslation } from '../i18n'
import { useProjectList, useProjectSessions, useProjectDirectoryValidation } from '../hooks/useProjectData'
import type { ProjectInfo } from '../../shared/types/ipc'
import ProjectCreateDialog from '../components/Project/ProjectCreateDialog'
import GitPanel from '../components/Project/GitPanel'

interface Props {
  selectedSessionId: string | null
  onSelectSession: (projectId: string, sessionId: string) => void
}

export default function ProjectsSidebar({ selectedSessionId, onSelectSession }: Props) {
  const { t } = useTranslation()
  const [projects, setProjects] = useAtom(projectsAtom)
  const [selectedProjectId, setSelectedProjectId] = useAtom(selectedProjectIdAtom)
  const [, setProjectRoot] = useAtom(projectRootAtom)
  const [, setApContext] = useAtom(apContextAtom)
  const [, setApVisible] = useAtom(apVisibleAtom)
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom)
  const setSessionEvents = useSetAtom(sessionEventsAtom)

  const api = getApi()

  // ── Data fetching (extracted to hooks) ──
  useProjectList(setProjects)
  const [projectSessions, setProjectSessions] = useProjectSessions(selectedProjectId)
  const missingDirProjectId = useProjectDirectoryValidation(selectedProjectId, projects)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [projectMenu, setProjectMenu] = useState<{ projectId: string; x: number; y: number } | null>(null)

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null

  // ── Actions ──

  const activateProject = useCallback((project: ProjectInfo) => {
    setSelectedProjectId(project.id)
    setProjectRoot(project.rootPath)
    setApContext('project')
  }, [setSelectedProjectId, setProjectRoot, setApContext])

  const handleCreateSession = useCallback((projectId: string) => {
    const tempId = createTempSessionId()
    setCurrentSessionId(tempId)
    setSessionEvents([])
  }, [setCurrentSessionId, setSessionEvents])

  const handleRemoveProject = useCallback(async (projectId: string) => {
    if (!confirm(t('project.removeConfirm'))) return
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
  }, [selectedProjectId, setProjects, setSelectedProjectId, setProjectRoot, setApContext, setApVisible, t])

  // Subscribe to session updates (new sessions appear when first message is sent)
  useEffect(() => {
    const unsubscribe = api.session.onUpdate(() => {
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

  // ── Render ──

  return (
    <div className="flex flex-col h-full">
      {/* Title row */}
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
            {t('project.directoryMissing')}
            <button
              onClick={() => handleRemoveProject(missingDirProjectId)}
              className="ml-2 text-[var(--app-error)] hover:underline"
            >
              {t('project.removeAction')}
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
                        {t('project.noSessions')}
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

                {/* Git status panel */}
                {selectedProjectId === project.id && (
                  <GitPanel projectRoot={project.rootPath} />
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
              <Trash2 className="w-3 h-3" /> {t('project.delete')}
            </button>
          </div>
        </>
      )}

      {/* Create project dialog */}
      <ProjectCreateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => {
          api.project.list().then((r) => {
            if (r.success && r.projects) setProjects(r.projects)
          }).catch(() => {})
        }}
      />
    </div>
  )
}
