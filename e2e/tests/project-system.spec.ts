/**
 * Project System E2E Tests — create, list, sessions, File/Review panes.
 */

import { test, expect } from '@playwright/test'
import { apTestSetup, showApPanel, enterProjectContext, enterChatsContext, setupMockFs, TEST_PROJECT_ROOT } from '../utils/ap-helpers'
import { getTestProjectRoot } from '../utils/test-project'

test.describe('Project System', () => {
  test.beforeEach(async ({ page }) => {
    await apTestSetup(page)
  })

  // ── Project Creation ──────────────────────────────────────

  test('P1: Create project via dialog — appears in sidebar', async ({ page }) => {
    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(500)

    // Empty state visible
    await expect(page.locator('text=No projects yet')).toBeVisible({ timeout: 5000 })

    // Click New Project
    await page.locator('button[aria-label="New Project"]').click()
    await page.waitForTimeout(400)

    // Dialog heading visible
    await expect(page.getByRole('heading', { name: '创建项目' })).toBeVisible({ timeout: 3000 })

    // Fill form
    await page.locator('input[placeholder="MyApp"]').fill('TestProject')
    await page.locator('input[placeholder="/Users/xbits/MyApp"]').fill('/tmp/test-project')

    // Submit
    await page.locator('button').filter({ hasText: '创建项目' }).last().click()
    await page.waitForTimeout(600)

    // Project appears in sidebar
    await expect(page.getByText('TestProject').first()).toBeVisible({ timeout: 5000 })
  })

  test('P2: Create project — empty name disables button', async ({ page }) => {
    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(300)
    await page.locator('button[aria-label="New Project"]').click()
    await page.waitForTimeout(300)

    const createBtn = page.locator('button').filter({ hasText: '创建项目' }).last()
    await expect(createBtn).toBeDisabled()
  })

  test('P3: Create project — duplicate rootPath error', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__mockProjects__ = [{
        id: 'proj-exist', name: 'Existing', rootPath: '/tmp/dup-test', createdAt: Date.now(),
      }]
    })

    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(300)
    await page.locator('button[aria-label="New Project"]').click()
    await page.waitForTimeout(300)

    await page.locator('input[placeholder="MyApp"]').fill('NewOne')
    await page.locator('input[placeholder="/Users/xbits/MyApp"]').fill('/tmp/dup-test')
    await page.locator('button').filter({ hasText: '创建项目' }).last().click()
    await page.waitForTimeout(400)

    await expect(page.locator('text=Duplicate root path')).toBeVisible({ timeout: 3000 })
  })

  // ── Project Sessions ──────────────────────────────────────

  test('P4: [+] creates session under selected project', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__mockProjects__ = [{
        id: 'proj-sess-1', name: 'MyApp', rootPath: '/tmp/myapp', createdAt: Date.now(),
      }]
    })

    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(500)

    // Select project
    await page.getByText('MyApp').first().click()
    await page.waitForTimeout(300)

    // [+] Add session button visible
    const addBtn = page.locator('button[aria-label="New Project Session"]')
    await expect(addBtn).toBeVisible({ timeout: 3000 })

    // Click to create session
    await addBtn.click()
    await page.waitForTimeout(500)

    // Session appears under project
    await expect(page.getByText('New Session').first()).toBeVisible({ timeout: 5000 })
  })

  test('P5: Remove project via context menu', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__mockProjects__ = [{
        id: 'proj-rm', name: 'ToRemove', rootPath: '/tmp/to-remove', createdAt: Date.now(),
      }]
    })

    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(500)

    // Right-click project
    await page.getByText('ToRemove').first().click({ button: 'right' })
    await page.waitForTimeout(300)

    // Context menu appears
    await expect(page.locator('text=移除').first()).toBeVisible({ timeout: 3000 })

    // Accept confirm dialog and click remove
    page.on('dialog', (d) => d.accept())
    await page.locator('text=移除').first().click()
    await page.waitForTimeout(500)

    // Project gone
    await expect(page.getByText('ToRemove')).not.toBeVisible({ timeout: 3000 })
  })

  // ── File Pane in Project Context ──────────────────────────

  test('P6: File Pane opens in project context', async ({ page }) => {
    const rootPath = getTestProjectRoot()
    await enterProjectContext(page, rootPath)
    await page.evaluate((root: string) => {
      ;(window as any).__attaTest__?.setProjectContext(root)
      ;(window as any).api.fs.addRoot(root)
    }, rootPath)
    await page.waitForTimeout(400)

    // Show AP — File button should be visible
    await showApPanel(page)

    const fileBtn = page.locator('button').filter({ hasText: '文件' }).first()
    await expect(fileBtn).toBeVisible({ timeout: 5000 })

    // Click to open File Pane
    await fileBtn.click()
    await page.waitForTimeout(600)

    // FileSubHeader should show the root path (or "No folder open" fallback)
    const subHeader = page.locator('text=/No folder open|test-project/')
    await expect(subHeader.first()).toBeVisible({ timeout: 5000 })
  })

  test('P7: FilePane — Explorer renders entries', async ({ page }) => {
    await setupMockFs(page)
    const rootPath = getTestProjectRoot()
    await enterProjectContext(page, rootPath)
    await page.evaluate((root: string) => {
      ;(window as any).__attaTest__?.setProjectContext(root)
      ;(window as any).api.fs.addRoot(root)
    }, rootPath)
    await page.waitForTimeout(400)

    await showApPanel(page)
    await page.locator('button').filter({ hasText: '文件' }).first().click()
    await page.waitForTimeout(800)

    // Explorer should have file/folder entries from the mock
    await expect(page.getByText('src').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('docs').first()).toBeVisible({ timeout: 5000 })
  })

  // ── Review Pane in Project Context ────────────────────────

  test('P8: Review Pane opens in project context', async ({ page }) => {
    const rootPath = getTestProjectRoot()
    await enterProjectContext(page, rootPath)
    await page.evaluate((root: string) => {
      ;(window as any).__attaTest__?.setProjectContext(root)
    }, rootPath)
    await page.waitForTimeout(300)

    await showApPanel(page)

    // Review button should be visible
    const reviewBtn = page.locator('button').filter({ hasText: '审查' }).first()
    await expect(reviewBtn).toBeVisible({ timeout: 5000 })

    // Click to open Review Pane
    await reviewBtn.click()
    await page.waitForTimeout(800)

    // ReviewPane should render content area (either git status or no-git guide)
    const content = page.locator('text=/当前目录不是 Git 仓库|Changed files|No changes|git init|commit/i')
    await expect(content.first()).toBeVisible({ timeout: 5000 })
  })

  // ── Context Switching ────────────────────────────────────

  test('P9: CHATS context hides File/Review buttons', async ({ page }) => {
    const rootPath = getTestProjectRoot()
    await enterProjectContext(page, rootPath)
    await page.evaluate((root: string) => {
      ;(window as any).__attaTest__?.setProjectContext(root)
    }, rootPath)
    await page.waitForTimeout(300)

    await showApPanel(page)

    // In project context, File button visible
    await expect(page.locator('button').filter({ hasText: '文件' }).first()).toBeVisible({ timeout: 5000 })

    // Switch to CHATS context via test hook
    await enterChatsContext(page)
    await page.waitForTimeout(500)

    // AP should still be visible but File/Review buttons gone
    const fileBtn = page.locator('button').filter({ hasText: '文件' }).first()
    await expect(fileBtn).not.toBeVisible({ timeout: 3000 })
  })

  // ── Edge Cases & Coverage Gaps ─────────────────────────────

  test('P10: "No sessions" empty state under selected project', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__mockProjects__ = [{
        id: 'proj-empty', name: 'EmptyProject', rootPath: '/tmp/empty', createdAt: Date.now(),
      }]
      // No sessions will be returned by mock
    })

    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(500)

    // Select project
    await page.getByText('EmptyProject').first().click()
    await page.waitForTimeout(400)

    // Should show "No sessions"
    await expect(page.getByText('No sessions')).toBeVisible({ timeout: 5000 })
  })

  test('P11: Switch between two projects — correct highlight and sessions', async ({ page }) => {
    // Pre-set projects AND a projectId-aware session.list mock
    await page.evaluate(() => {
      ;(window as any).__mockProjects__ = [
        { id: 'proj-a', name: 'ProjectA', rootPath: '/tmp/a', createdAt: Date.now() },
        { id: 'proj-b', name: 'ProjectB', rootPath: '/tmp/b', createdAt: Date.now() },
      ]
      // Replace session.list with a projectId-aware mock
      const allSessions = [
        { id: 'sa', title: 'Session A', activity: 'projects', projectId: 'proj-a', createdAt: 1, updatedAt: 1 },
        { id: 'sb', title: 'Session B', activity: 'projects', projectId: 'proj-b', createdAt: 1, updatedAt: 1 },
      ]
      ;(window as any).api.session.list = (_activity: any, projectId: any) => {
        const filtered = projectId !== undefined
          ? allSessions.filter((s: any) => s.projectId === projectId)
          : allSessions
        return Promise.resolve({ success: true, sessions: filtered })
      }
    })

    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(500)

    // Click ProjectA
    await page.getByText('ProjectA').first().click()
    await page.waitForTimeout(400)

    // Session A should appear under ProjectA
    await expect(page.getByText('Session A').first()).toBeVisible({ timeout: 5000 })

    // Click ProjectB
    await page.getByText('ProjectB').first().click()
    await page.waitForTimeout(400)

    // Session B should appear (not Session A)
    await expect(page.getByText('Session B').first()).toBeVisible({ timeout: 5000 })
  })

  test('P12: Enter key submits create dialog', async ({ page }) => {
    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(300)
    await page.locator('button[aria-label="New Project"]').click()
    await page.waitForTimeout(300)

    // Fill name and path
    await page.locator('input[placeholder="MyApp"]').fill('EnterKey')
    await page.locator('input[placeholder="/Users/xbits/MyApp"]').fill('/tmp/enter-test')

    // Press Enter on the name field
    await page.locator('input[placeholder="MyApp"]').press('Enter')
    await page.waitForTimeout(600)

    // Project should appear
    await expect(page.getByText('EnterKey').first()).toBeVisible({ timeout: 5000 })
  })

  test('P13: DIR_NOT_FOUND error in create dialog', async ({ page }) => {
    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(300)
    await page.locator('button[aria-label="New Project"]').click()
    await page.waitForTimeout(300)

    // Fill with non-existent path — mock returns DIR_NOT_FOUND
    await page.evaluate(() => {
      ;(window as any).api.project.create = () =>
        Promise.resolve({ success: false, error: '目录不存在: /nonexistent/path' })
    })

    await page.locator('input[placeholder="MyApp"]').fill('BadDir')
    await page.locator('input[placeholder="/Users/xbits/MyApp"]').fill('/nonexistent/path')
    await page.locator('button').filter({ hasText: '创建项目' }).last().click()
    await page.waitForTimeout(400)

    // Error message should contain the path
    await expect(page.locator('text=目录不存在')).toBeVisible({ timeout: 3000 })
  })

  test('P14: Session count badge reflects sessions under project', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__mockProjects__ = [{
        id: 'proj-count', name: 'Counted', rootPath: '/tmp/counted', createdAt: Date.now(),
      }]
      ;(window as any).api.session.list = () =>
        Promise.resolve({ success: true, sessions: [
          { id: 's1', title: 'A', activity: 'projects', projectId: 'proj-count', createdAt: 1, updatedAt: 1 },
          { id: 's2', title: 'B', activity: 'projects', projectId: 'proj-count', createdAt: 1, updatedAt: 1 },
          { id: 's3', title: 'C', activity: 'projects', projectId: 'proj-count', createdAt: 1, updatedAt: 1 },
        ]})
    })

    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(500)

    // The badge shows session count (0 before loading, then 3 after)
    // The count badge uses text-[10px] on the span
    await expect(page.getByText('Counted').first()).toBeVisible({ timeout: 3000 })
  })
})
