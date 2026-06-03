export interface ProjectSession {
  id: string
  name: string
  summary: string
}

export interface ProjectItem {
  id: string
  name: string
  sessions: ProjectSession[]
}

export const MOCK_PROJECTS: ProjectItem[] = [
  {
    id: 'attaseek',
    name: 'AttaSeek',
    sessions: [
      { id: 's1', name: 'Refactor API module', summary: 'Agent restructured the API layer into modular endpoints with shared types' },
      { id: 's2', name: 'Write test suite', summary: 'Added 45 unit tests covering atoms, components, and IPC handlers' },
      { id: 's3', name: 'Fix bridge connection', summary: 'Resolved WebSocket reconnection loop on network change' }
    ]
  },
  {
    id: 'clawpod',
    name: 'ClawPod',
    sessions: [
      { id: 's4', name: 'Update proto definitions', summary: 'Regenerated TypeScript types from updated .proto schemas' },
      { id: 's5', name: 'Tauri window config', summary: 'Fixed vibrancy and traffic lights alignment on macOS Sequoia' }
    ]
  },
  {
    id: 'attacloud',
    name: 'AttaCloud',
    sessions: [
      { id: 's6', name: 'Deploy coturn setup', summary: 'Configured TURN server with ephemeral credentials rotation' }
    ]
  },
  {
    id: 'opensource',
    name: 'OpenSource',
    sessions: [
      { id: 's7', name: 'PR review #42', summary: 'Reviewed and merged dependency upgrade PR with breaking change notes' },
      { id: 's8', name: 'Update README', summary: 'Rewrote installation guide and added architecture diagram' },
      { id: 's9', name: 'Release v0.2', summary: 'Prepared release notes, bumped version, tagged and published' },
      { id: 's10', name: 'Fix CI pipeline', summary: 'Resolved flaky E2E test and updated Node version matrix' }
    ]
  }
]

export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

export const MOCK_FILE_TREE: TreeNode[] = [
  {
    name: 'src', path: 'src', type: 'directory', children: [
      { name: 'main', path: 'src/main', type: 'directory', children: [
        { name: 'index.ts', path: 'src/main/index.ts', type: 'file' },
        { name: 'ipc', path: 'src/main/ipc', type: 'directory', children: [
          { name: 'theme.ts', path: 'src/main/ipc/theme.ts', type: 'file' }
        ]}
      ]},
      { name: 'preload', path: 'src/preload', type: 'directory', children: [
        { name: 'index.ts', path: 'src/preload/index.ts', type: 'file' },
        { name: 'index.d.ts', path: 'src/preload/index.d.ts', type: 'file' }
      ]},
      { name: 'renderer', path: 'src/renderer', type: 'directory', children: [
        { name: 'App.tsx', path: 'src/renderer/App.tsx', type: 'file' },
        { name: 'main.tsx', path: 'src/renderer/main.tsx', type: 'file' },
        { name: 'layouts', path: 'src/renderer/layouts', type: 'directory', children: [
          { name: 'Shell.tsx', path: 'src/renderer/layouts/Shell.tsx', type: 'file' },
          { name: 'WorkspaceLayout.tsx', path: 'src/renderer/layouts/WorkspaceLayout.tsx', type: 'file' },
          { name: 'WorkspaceRouter.tsx', path: 'src/renderer/layouts/WorkspaceRouter.tsx', type: 'file' }
        ]},
        { name: 'components', path: 'src/renderer/components', type: 'directory', children: [
          { name: 'ActivityBar', path: 'src/renderer/components/ActivityBar', type: 'directory', children: [
            { name: 'ActivityBar.tsx', path: 'src/renderer/components/ActivityBar/ActivityBar.tsx', type: 'file' }
          ]},
          { name: 'Conversation', path: 'src/renderer/components/Conversation', type: 'directory', children: [
            { name: 'Composer.tsx', path: 'src/renderer/components/Conversation/Composer.tsx', type: 'file' },
            { name: 'SessionHeader.tsx', path: 'src/renderer/components/Conversation/SessionHeader.tsx', type: 'file' }
          ]}
        ]}
      ]}
    ]
  },
  { name: 'package.json', path: 'package.json', type: 'file' },
  { name: 'tsconfig.json', path: 'tsconfig.json', type: 'file' },
  { name: 'tsconfig.web.json', path: 'tsconfig.web.json', type: 'file' }
]

export interface DiffFile {
  filename: string
  additions: number
  deletions: number
  status: 'modified' | 'added' | 'deleted'
}

export const MOCK_DIFF_FILES: DiffFile[] = [
  { filename: 'src/renderer/App.tsx', additions: 12, deletions: 3, status: 'modified' },
  { filename: 'src/renderer/layouts/Shell.tsx', additions: 8, deletions: 20, status: 'modified' },
  { filename: 'src/renderer/components/ActivityBar/ActivityBar.tsx', additions: 5, deletions: 8, status: 'modified' },
  { filename: 'src/renderer/workspaces/ChatsSidebar.tsx', additions: 0, deletions: 0, status: 'added' },
  { filename: 'src/renderer/components/TitleBar/TitleBar.tsx', additions: 0, deletions: 40, status: 'deleted' }
]
