import { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import WorkspaceLayout from '../layouts/WorkspaceLayout'
import OutputArea from '../components/OutputArea/OutputArea'
import ProjectsSidebar from './ProjectsSidebar'
import { outputAreaVisibleAtom, outputTabsAtom, activeOutputTabAtom } from '../atoms/outputTabsAtom'
import type { ProjectItem } from './mock/projects'
import { ArrowLeft } from 'lucide-react'

export default function ProjectsWorkspace() {
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [outputWidth, setOutputWidth] = useState(400)
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [, setOutputVisible] = useAtom(outputAreaVisibleAtom)
  const [, setTabs] = useAtom(outputTabsAtom)
  const [, setActiveTab] = useAtom(activeOutputTabAtom)

  // Initialize output area with Files + Review tabs
  useEffect(() => {
    const filesTab = { id: 'projects-files', type: 'files' as const, label: 'Files' }
    const reviewTab = { id: 'projects-review', type: 'review' as const, label: 'Review' }
    setTabs([filesTab, reviewTab])
    setActiveTab(filesTab.id)
    setOutputVisible(true)
    return () => {
      setOutputVisible(false)
      setTabs([])
    }
  }, [])

  const session = selectedProject?.sessions.find((s) => s.id === selectedSessionId)

  return (
    <div className="flex flex-1 min-w-0">
      <WorkspaceLayout.Left
        width={sidebarWidth}
        onResize={(d) => setSidebarWidth((w) => Math.min(500, Math.max(160, w + d)))}
      >
        <ProjectsSidebar
          selectedProject={selectedProject}
          selectedSessionId={selectedSessionId}
          onSelectProject={(p) => {
            setSelectedProject(p)
            setSelectedSessionId(null)
          }}
          onSelectSession={(_, sid) => {
            setSelectedSessionId(sid)
          }}
          onBackToProjects={() => {
            setSelectedProject(null)
            setSelectedSessionId(null)
          }}
        />
      </WorkspaceLayout.Left>

      {selectedProject ? (
        <WorkspaceLayout.Main>
          {/* Session content or project empty state */}
          {session ? (
            <div className="flex flex-col flex-1 min-h-0">
              <div
                className="flex-shrink-0 h-[40px] flex items-center gap-2 px-4 border-b border-[var(--app-border)]"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
              >
                <span className="text-xs font-medium text-[var(--app-text)]">{session.name}</span>
                <span className="text-[10px] text-[var(--app-text-dim)]">
                  {selectedProject.name}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-2xl space-y-4">
                  <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] p-4">
                    <p className="text-xs text-[var(--app-text)] leading-relaxed">{session.summary}</p>
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="px-4 py-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]">
                        <p className="text-[10px] text-[var(--app-text-dim)] mb-1">
                          {i === 1 ? 'Agent response' : i === 2 ? 'Tool call' : 'User message'}
                        </p>
                        <p className="text-xs text-[var(--app-text-secondary)]">
                          {i === 1
                            ? "I'll restructure the API layer into modular endpoints with shared types."
                            : i === 2
                            ? 'read src/api.ts — 200 lines loaded'
                            : 'Can you also update the preload types?'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1">
              <p className="text-xs text-[var(--app-text-dim)]">
                Select a session to view its content
              </p>
            </div>
          )}
        </WorkspaceLayout.Main>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="w-16 h-16 rounded-2xl bg-[var(--app-bg-hover)] flex items-center justify-center mb-4">
            <span className="text-2xl text-[var(--app-text-dim)]">📂</span>
          </div>
          <p className="text-xs text-[var(--app-text-dim)]">Select a project to get started</p>
        </div>
      )}

      {selectedProject && (
        <WorkspaceLayout.Right
          width={outputWidth}
          onResize={(d) => setOutputWidth((w) => Math.min(800, Math.max(240, w + d)))}
        >
          <OutputArea />
        </WorkspaceLayout.Right>
      )}
    </div>
  )
}
