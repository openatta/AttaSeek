/**
 * Shared helpers for AP E2E tests.
 */

import { type Page } from '@playwright/test'
import path from 'path'
import { promises as fs } from 'fs'
import { getTestProjectRoot } from './test-project'

export const MOCK_API_PATH = path.resolve(__dirname, '..', 'fixtures', 'mock-api.js')
export const TEST_PROJECT_ROOT = getTestProjectRoot()

const TEXT_EXTS = new Set(['.ts', '.tsx', '.js', '.json', '.md', '.html', '.css', '.txt'])

/** Common beforeEach for all AP tests: inject mock API, navigate, enter chat workspace */
export async function apTestSetup(page: Page): Promise<void> {
  await page.addInitScript({ path: MOCK_API_PATH })
  await page.goto('/')
  await page.waitForTimeout(2000)
  await page.evaluate(() => (window as any).__mockReset__?.())
  // Enter the Chat workspace — the AP panel toggle is in the SessionHeader
  // which only renders inside the Chat workspace.
  const newSessionBtn = page.locator('button[aria-label="New Session"]').first()
  if (await newSessionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await newSessionBtn.click()
    await page.waitForTimeout(800)
  }
}

/** Make the AP panel visible by clicking the Show output area button */
export async function showApPanel(page: Page): Promise<void> {
  const btn = page.locator('button[aria-label="Show output area"]')
  await btn.waitFor({ state: 'visible', timeout: 8000 })
  await btn.click()
  await page.waitForTimeout(600)
}

/**
 * Switch to project context via the test hook.
 * Sets apContextAtom='project', projectRootAtom=rootPath,
 * and registers the root path with the fs mock API.
 */
export async function enterProjectContext(page: Page, rootPath: string): Promise<void> {
  await page.evaluate((root: string) => {
    const tt = (window as any).__attaTest__
    if (tt) tt.setProjectContext(root)
    // Register the root with fs mock
    ;(window as any).api.fs.addRoot(root)
  }, rootPath)
  await page.waitForTimeout(300)
}

/** Switch back to CHATS context */
export async function enterChatsContext(page: Page): Promise<void> {
  await page.evaluate(() => {
    const tt = (window as any).__attaTest__
    if (tt) tt.setChatsContext()
  })
  await page.waitForTimeout(300)
}

/** Trigger mock terminal output for testing xterm rendering */
export async function emitTerminalOutput(
  page: Page,
  terminalId: string,
  data: string,
): Promise<void> {
  await page.evaluate(
    ({ tid, d }: { tid: string; d: string }) => {
      const listeners = (window as any).__mockTerminalListeners__ || []
      listeners.forEach((cb: any) => {
        try { cb({ terminalId: tid, data: d }) } catch { /* ignore */ }
      })
    },
    { tid: terminalId, d: data },
  )
}

/**
 * Set up mock filesystem data by reading the test project directory.
 * Returns the entries array for use in assertions.
 */
export async function setupMockFs(page: Page): Promise<void> {
  const root = getTestProjectRoot()
  const files: Record<string, { content: string; size: number; mime?: string }> = {}
  const entries: any[] = []

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
        const mimeMap: Record<string, string> = {
          '.ts': 'text/typescript', '.tsx': 'text/typescript',
          '.js': 'text/javascript', '.json': 'application/json',
          '.md': 'text/markdown', '.html': 'text/html', '.css': 'text/css',
          '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
          '.pdf': 'application/pdf',
        }
        const entry = { name: d.name, path: fullPath, isDir: false, size: stat.size, mime: mimeMap[ext] }
        entries.push(entry)
        if (TEXT_EXTS.has(ext) || d.name.startsWith('.')) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8')
            files[fullPath] = { content, size: stat.size, mime: mimeMap[ext] }
          } catch { /* binary */ }
        }
      }
    }
  }

  await walk(root)

  await page.evaluate(({ e, f }: { e: any[]; f: any }) => {
    (window as any).__mockSetFsData__(e, f)
  }, { e: entries, f: files })
}

/** Set up mock git data for Review Pane tests */
export async function setupMockGit(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__mockSetGitData__({
      branch: 'master',
      branches: ['master', 'feat/new-feature', 'fix/bug-123'],
      changedFiles: [
        { path: 'src/App.tsx', status: 'modified', staged: false, additions: 1, deletions: 0 },
        { path: 'src/utils.ts', status: 'modified', staged: true, additions: 6, deletions: 0 },
        { path: '.gitignore', status: 'untracked', staged: false, additions: 1, deletions: 0 },
      ],
      diffFiles: [
        {
          path: 'src/App.tsx', status: 'modified', additions: 1, deletions: 0,
          hunks: [{ header: '@@ -29,3 +29,4 @@', lines: ['     </div>', '   );', ' }', '+// TODO: add more features'] }],
          oldContent: 'export default function App() {\n  return <div>Hello</div>;\n}\n',
          newContent: 'export default function App() {\n  return <div>Hello</div>;\n}\n// TODO: add more features\n',
        },
      ],
      commits: [
        { hash: '5'.repeat(40), shortHash: '54262d6', message: 'feat: add async data fetching', author: 'Test', date: Date.now() - 3600000 },
        { hash: 'f'.repeat(40), shortHash: 'f783f3f', message: 'Initial commit', author: 'Test', date: Date.now() - 7200000 },
      ],
    })
  })
}

/** Set git to "not a repo" state */
export async function setupNoGit(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).__mockSetNoGit__())
}
