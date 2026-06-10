/**
 * Test project helper — reads the fixture project directory and
 * produces mock data structures for the fs/git mock APIs.
 *
 * Used by Playwright tests to inject realistic file system data
 * into the browser context via page.evaluate.
 */

import { promises as fs } from 'fs'
import path from 'path'

const PROJECT_ROOT = path.resolve(__dirname, '..', 'fixtures', 'test-project')

export interface MockDirEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  mime?: string
}

export interface MockGitFileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
  additions: number
  deletions: number
}

export interface MockGitDiffFile {
  path: string
  status: string
  additions: number
  deletions: number
  hunks: { header: string; lines: string[] }[]
  oldContent: string
  newContent: string
}

function mimeFromExt(ext: string): string | undefined {
  const map: Record<string, string> = {
    '.ts': 'text/typescript', '.tsx': 'text/typescript',
    '.js': 'text/javascript', '.json': 'application/json',
    '.md': 'text/markdown', '.html': 'text/html', '.css': 'text/css',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
  }
  return map[ext]
}

/**
 * Read the test project directory recursively and return DirEntry[].
 */
export async function readTestProject(): Promise<MockDirEntry[]> {
  const entries: MockDirEntry[] = []

  async function walk(dir: string): Promise<void> {
    const dirents = await fs.readdir(dir, { withFileTypes: true })
    for (const d of dirents) {
      if (d.name.startsWith('.git')) continue
      const fullPath = path.join(dir, d.name)
      if (d.isDirectory()) {
        entries.push({ name: d.name, path: fullPath, isDir: true, size: 0 })
        await walk(fullPath)
      } else {
        const stat = await fs.stat(fullPath)
        const ext = path.extname(d.name).toLowerCase()
        entries.push({
          name: d.name,
          path: fullPath,
          isDir: false,
          size: stat.size,
          mime: mimeFromExt(ext),
        })
      }
    }
  }

  await walk(PROJECT_ROOT)
  return entries
}

/**
 * Read file content from the test project.
 */
export async function readTestFile(relativePath: string): Promise<{
  content: string
  size: number
  mime?: string
}> {
  const fullPath = path.join(PROJECT_ROOT, relativePath)
  const stat = await fs.stat(fullPath)
  const ext = path.extname(fullPath).toLowerCase()
  return {
    content: await fs.readFile(fullPath, 'utf-8'),
    size: stat.size,
    mime: mimeFromExt(ext),
  }
}

/**
 * Build mock git status data for the test project.
 */
export function mockGitData(): {
  branch: string
  branches: string[]
  changedFiles: MockGitFileStatus[]
  commits: { hash: string; shortHash: string; message: string; author: string; date: number }[]
  diffFiles: MockGitDiffFile[]
} {
  return {
    branch: 'master',
    branches: ['master', 'feat/new-feature', 'fix/bug-123'],
    changedFiles: [
      {
        path: 'src/App.tsx',
        status: 'modified',
        staged: false,
        additions: 1,
        deletions: 0,
      },
      {
        path: 'src/utils.ts',
        status: 'modified',
        staged: true,
        additions: 6,
        deletions: 0,
      },
      {
        path: '.gitignore',
        status: 'untracked',
        staged: false,
        additions: 1,
        deletions: 0,
      },
    ],
    commits: [
      {
        hash: '54262d6' + '0'.repeat(33),
        shortHash: '54262d6',
        message: 'feat: add async data fetching utility',
        author: 'AttaSeek Test',
        date: Date.now() - 3600000,
      },
      {
        hash: 'f783f3f' + '0'.repeat(33),
        shortHash: 'f783f3f',
        message: 'Initial commit: test project with code, docs, and assets',
        author: 'AttaSeek Test',
        date: Date.now() - 7200000,
      },
    ],
    diffFiles: [
      {
        path: 'src/App.tsx',
        status: 'modified',
        additions: 1,
        deletions: 0,
        hunks: [
          {
            header: '@@ -29,3 +29,4 @@',
            lines: [
              '     </div>',
              '   );',
              ' }',
              '+// TODO: add more features',
            ],
          },
        ],
        oldContent: `export default function App({ title, count }: AppProps) {
  const [items, setItems] = React.useState<string[]>([]);

  const addItem = (name: string) => {
    setItems((prev) => [...prev, name]);
  };

  return (
    <div className="app">
      <h1>{title}</h1>
      <p>Count: {count}</p>
      <ul className="item-list">
        {items.map((item, i) => (
          <li key={i} className="item">
            {item}
          </li>
        ))}
      </ul>
      <button onClick={() => addItem(\`Item \${items.length + 1}\`)}>
        Add Item
      </button>
    </div>
  );
}`,
        newContent: `export default function App({ title, count }: AppProps) {
  const [items, setItems] = React.useState<string[]>([]);

  const addItem = (name: string) => {
    setItems((prev) => [...prev, name]);
  };

  return (
    <div className="app">
      <h1>{title}</h1>
      <p>Count: {count}</p>
      <ul className="item-list">
        {items.map((item, i) => (
          <li key={i} className="item">
            {item}
          </li>
        ))}
      </ul>
      <button onClick={() => addItem(\`Item \${items.length + 1}\`)}>
        Add Item
      </button>
    </div>
  );
}
// TODO: add more features`,
      },
    ],
  }
}

export function getTestProjectRoot(): string {
  return PROJECT_ROOT
}
