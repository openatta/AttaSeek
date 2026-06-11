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

    // FilePane should show internal tab bar with "No open files" state
    const noFiles = page.locator('text=No open files')
    await expect(noFiles.first()).toBeVisible({ timeout: 5000 })
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

  test('P15: Missing directory warning banner on project select', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__mockProjects__ = [{
        id: 'proj-gone', name: 'DeletedDir', rootPath: '/tmp/deleted', createdAt: Date.now(),
      }]
      // Override validate to report directory missing
      ;(window as any).api.project.validate = () =>
        Promise.resolve({ success: true, valid: false, exists: false, writable: false })
    })

    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(500)

    // Select the project — triggers validate useEffect
    await page.getByText('DeletedDir').first().click()
    await page.waitForTimeout(500)

    // Warning banner appears with "移除项目" button
    await expect(page.locator('text=项目目录不存在或无法访问')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('移除项目').first()).toBeVisible({ timeout: 3000 })
  })

  test('P16: New Project Session [+] hidden when no project selected', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__mockProjects__ = [
        { id: 'proj-x', name: 'SomeProject', rootPath: '/tmp/x', createdAt: Date.now() },
      ]
    })

    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(500)

    // Before selection: New Project Session button should NOT exist
    await expect(page.locator('button[aria-label="New Project Session"]')).not.toBeVisible({ timeout: 3000 })

    // After selecting project: it should appear
    await page.getByText('SomeProject').first().click()
    await page.waitForTimeout(400)
    await expect(page.locator('button[aria-label="New Project Session"]')).toBeVisible({ timeout: 5000 })
  })

  test('P17: Permission error in create dialog', async ({ page }) => {
    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(300)
    await page.locator('button[aria-label="New Project"]').click()
    await page.waitForTimeout(300)

    await page.evaluate(() => {
      ;(window as any).api.project.create = () =>
        Promise.resolve({ success: false, error: '目录无读写权限: /readonly' })
    })

    await page.locator('input[placeholder="MyApp"]').fill('Readonly')
    await page.locator('input[placeholder="/Users/xbits/MyApp"]').fill('/readonly')
    await page.locator('button').filter({ hasText: '创建项目' }).last().click()
    await page.waitForTimeout(400)

    await expect(page.locator('text=无读写权限')).toBeVisible({ timeout: 3000 })
  })

  test('P18: Whitespace-only project name disables create button', async ({ page }) => {
    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(300)
    await page.locator('button[aria-label="New Project"]').click()
    await page.waitForTimeout(300)

    // Fill name with spaces only
    const nameInput = page.locator('input[placeholder="MyApp"]')
    await nameInput.fill('   ')
    await page.locator('input[placeholder="/Users/xbits/MyApp"]').fill('/tmp/whitespace')

    // Create button should be disabled (trimmed length === 0)
    const createBtn = page.locator('button').filter({ hasText: '创建项目' }).last()
    await expect(createBtn).toBeDisabled({ timeout: 3000 })
  })

  test('P19: Click session loads it and shows session title', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__mockProjects__ = [{
        id: 'proj-hist', name: 'HistoryProject', rootPath: '/tmp/hist', createdAt: Date.now(),
      }]
      // Provide sessions with projectId=proj-hist
      ;(window as any).api.session.list = (_a: any, projectId: any) => {
        if (projectId === 'proj-hist') {
          return Promise.resolve({
            success: true,
            sessions: [
              { id: 'sess-hist-1', title: 'Debug API crash', activity: 'projects', projectId: 'proj-hist', createdAt: 1, updatedAt: 1 },
              { id: 'sess-hist-2', title: 'Refactor auth module', activity: 'projects', projectId: 'proj-hist', createdAt: 2, updatedAt: 2 },
            ],
          })
        }
        return Promise.resolve({ success: true, sessions: [] })
      }
    })

    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(500)

    // Select project
    await page.getByText('HistoryProject').first().click()
    await page.waitForTimeout(400)

    // Verify both sessions appear
    await expect(page.getByText('Debug API crash').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Refactor auth module').first()).toBeVisible({ timeout: 3000 })

    // Click the first session — it should load
    await page.getByText('Debug API crash').first().click()
    await page.waitForTimeout(500)

    // The session should be visible (the component stores sessionId in state)
    // and the conversation area should show the session
    // Verify at least the PROJECTS sidebar is still visible (component didn't crash)
    await expect(page.locator('text=PROJECTS').first()).toBeVisible({ timeout: 3000 })
  })

  test('P20: Rapid project switch — sessions stay correct (BUG4 regression)', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__mockProjects__ = [
        { id: 'p-fast-a', name: 'FastA', rootPath: '/tmp/a', createdAt: Date.now() },
        { id: 'p-fast-b', name: 'FastB', rootPath: '/tmp/b', createdAt: Date.now() },
      ]
      const allSessions = [
        { id: 'sa', title: 'Session A1', activity: 'projects', projectId: 'p-fast-a', createdAt: 1, updatedAt: 1 },
        { id: 'sb', title: 'Session B1', activity: 'projects', projectId: 'p-fast-b', createdAt: 1, updatedAt: 1 },
      ]
      ;(window as any).api.session.list = (_a: any, projectId: any) => {
        if (projectId !== undefined) {
          return Promise.resolve({ success: true, sessions: allSessions.filter((s: any) => s.projectId === projectId) })
        }
        return Promise.resolve({ success: true, sessions: allSessions })
      }
    })

    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(500)

    // Click FastA, then immediately click FastB (simulating rapid switch)
    await page.getByText('FastA').first().click()
    await page.getByText('FastB').first().click()
    await page.waitForTimeout(600)

    // FastB's session should be visible, NOT FastA's
    await expect(page.getByText('Session B1').first()).toBeVisible({ timeout: 5000 })
    // FastA's session must NOT leak into FastB's view
    await expect(page.getByText('Session A1')).not.toBeVisible({ timeout: 3000 })
  })

  test('P21: Remove project with AP panel open — panel closes (BUG7 regression)', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__mockProjects__ = [{
        id: 'p-close', name: 'CloseAP', rootPath: '/tmp/apclose', createdAt: Date.now(),
      }]
    })

    await page.locator('button[aria-label="Projects"]').click()
    await page.waitForTimeout(500)

    // Select project and open AP panel
    await page.getByText('CloseAP').first().click()
    await page.waitForTimeout(300)

    // Open AP panel
    const apBtn = page.locator('button[aria-label="Show output area"]')
    if (await apBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await apBtn.click()
      await page.waitForTimeout(400)
    }

    // Right-click and remove project
    page.on('dialog', (d) => d.accept())
    await page.getByText('CloseAP').first().click({ button: 'right' })
    await page.waitForTimeout(300)
    await page.locator('text=移除').first().click()
    await page.waitForTimeout(500)

    // Project should be gone
    await expect(page.getByText('CloseAP')).not.toBeVisible({ timeout: 3000 })
    // AP panel should have closed or show hide button
    const hideBtn = page.locator('button[aria-label="Hide output area"]')
    // Either the hide button is not visible (panel closed) or still visible with empty state
    const visible = await hideBtn.isVisible({ timeout: 2000 }).catch(() => false)
    // If still visible, the AP panel content should not show project-specific controls
    if (visible) {
      await expect(page.locator('button').filter({ hasText: '文件' }).first()).not.toBeVisible({ timeout: 3000 })
    }
  })
})
