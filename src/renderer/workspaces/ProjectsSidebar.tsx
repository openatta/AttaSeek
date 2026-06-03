import { useState } from 'react'
import { Plus } from 'lucide-react'
import { MOCK_PROJECTS, type ProjectItem } from './mock/projects'

interface Props {
  selectedProject: ProjectItem | null
  selectedSessionId: string | null
  onSelectProject: (project: ProjectItem) => void
  onSelectSession: (projectId: string, sessionId: string) => void
  onBackToProjects: () => void
}

export default function ProjectsSidebar({
  selectedProject,
  selectedSessionId,
  onSelectProject,
  onSelectSession,
  onBackToProjects
}: Props) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const activeProjectId = selectedProject?.id ?? null

  return (
    <div className="flex flex-col h-full">
      {/* Draggable header */}
      <div
        className="flex-shrink-0 h-[40px]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* Title row */}
      <div className="flex items-center px-4 pb-2">
        {selectedProject ? (
          <button
            onClick={onBackToProjects}
            className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider hover:text-[var(--app-text)] transition-colors"
          >
            ← PROJECTS
          </button>
        ) : (
          <>
            <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
              PROJECTS
            </h2>
            <div className="flex-1" />
            <button
              className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
              title="New Project"
              aria-label="New Project"
            >
              <Plus className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {selectedProject ? (
          /* Level 2: project sessions */
          <div>
            <div className="px-4 pb-2">
              <p className="text-xs font-medium text-[var(--app-text)]">{selectedProject.name}</p>
              <p className="text-[10px] text-[var(--app-text-dim)]">{selectedProject.sessions.length} sessions</p>
            </div>
            <div className="px-2">
              <p className="px-2 py-1 text-[10px] text-[var(--app-text-dim)] uppercase tracking-wider">
                Recent Sessions
              </p>
              {selectedProject.sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelectSession(selectedProject.id, s.id)}
                  className={`w-full text-left px-2 py-2 rounded transition-colors
                    ${selectedSessionId === s.id
                      ? 'bg-[var(--app-bg-active)]'
                      : 'hover:bg-[var(--app-bg-hover)]'
                    }`}
                >
                  <p className="text-xs text-[var(--app-text)] truncate">{s.name}</p>
                  <p className="text-[10px] text-[var(--app-text-dim)] mt-0.5 truncate">{s.summary}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Level 1: project list */
          <div className="px-2">
            {MOCK_PROJECTS.map((project: ProjectItem) => (
              <div key={project.id}>
                <button
                  onClick={() => {
                    toggleExpand(project.id)
                    onSelectProject(project)
                  }}
                  className={'w-full flex items-center gap-2 px-2 py-2 rounded text-xs transition-colors' +
                    (activeProjectId === project.id
                      ? ' bg-[var(--app-bg-active)] text-[var(--app-text)]'
                      : ' text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]')}
                >
                  <span className="text-[10px]">{expandedProjects.has(project.id) ? '▼' : '▶'}</span>
                  <span className="flex-1 truncate">{project.name}</span>
                  <span className="text-[10px] text-[var(--app-text-dim)]">{project.sessions.length}</span>
                </button>
                {expandedProjects.has(project.id) && project.sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSelectProject(project)
                      onSelectSession(project.id, s.id)
                    }}
                    className="w-full text-left pl-8 pr-2 py-1.5 text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] rounded transition-colors truncate"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
