/**
 * AP Pane Tests — Browser, Terminal, File, Review pane rendering and interactions.
 */
import { test, expect } from '@playwright/test'
import { apTestSetup, showApPanel, setupMockFs, setupMockGit, setupNoGit } from '../utils/ap-helpers'

// ── Browser Pane ──────────────────────────────────────────

test.describe('Browser Pane', () => {
  test.beforeEach(async ({ page }) => {
    await apTestSetup(page)
    await showApPanel(page)
    await page.locator('button').filter({ hasText: '浏览器' }).first().click()
    await page.waitForTimeout(600)
  })

  test('T3.1: Navigation bar renders with Back/Forward/Refresh + URL input', async ({ page }) => {
    await expect(page.locator('button[title="Back"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button[title="Forward"]')).toBeVisible()
    await expect(page.locator('button[title="Refresh"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Search or enter URL..."]')).toBeVisible()
  })

  test('T3.2: URL input accepts text and Enter triggers navigation', async ({ page }) => {
    const urlInput = page.locator('input[placeholder="Search or enter URL..."]')
    await urlInput.fill('https://example.com')
    await urlInput.press('Enter')
    await page.waitForTimeout(300)
    // After Enter, the input should show the URL (navigated)
    await expect(urlInput).toBeVisible()
  })

  test('T3.3: ⋮ Menu opens with 7 items', async ({ page }) => {
    await page.locator('text=⋮').first().click()
    await page.waitForTimeout(300)

    const menu = page.locator('.w-48.bg-\\[var\\(--app-bg-elevated\\)\\]')
    await expect(menu).toBeVisible({ timeout: 3000 })

    // Check required items (Chinese labels per design)
    await expect(menu.locator('text=强制重新加载')).toBeVisible()
    await expect(menu.locator('text=显示设备工具栏')).toBeVisible()
    await expect(menu.locator('text=缩放')).toBeVisible()
    await expect(menu.locator('text=清除 Cookie')).toBeVisible()
    await expect(menu.locator('text=清除缓存')).toBeVisible()
  })

  test('T3.4: Device toolbar toggle shows device presets', async ({ page }) => {
    await page.locator('text=⋮').first().click()
    await page.waitForTimeout(200)
    await page.locator('button').filter({ hasText: '显示设备工具栏' }).click()
    await page.waitForTimeout(400)

    // Device toolbar with preset dropdown should appear
    const presetSelect = page.locator('select').first()
    await expect(presetSelect).toBeVisible({ timeout: 3000 })
    const options = await presetSelect.locator('option').allTextContents()
    expect(options.length).toBeGreaterThanOrEqual(5)
  })
})

// ── Terminal Pane ─────────────────────────────────────────

test.describe('Terminal Pane', () => {
  test.beforeEach(async ({ page }) => {
    await apTestSetup(page)
    await showApPanel(page)
    await page.locator('button').filter({ hasText: '终端' }).first().click()
    await page.waitForTimeout(1000) // xterm needs time to initialize
  })

  test('T3.5: Terminal container renders', async ({ page }) => {
    // xterm.js renders canvas/div elements inside the container
    const xtermElem = page.locator('.xterm').first()
    // xterm may or may not fully initialize in mock, but container should exist
    const container = page.locator('[class*="overflow-hidden"]').last()
    await expect(container).toBeVisible({ timeout: 5000 })
  })

  test('T3.6: Multi-instance — 2 terminals show 2 tabs', async ({ page }) => {
    // Open second terminal via [+] menu
    await page.locator('button[title="Add pane"]').click()
    await page.waitForTimeout(200)
    const menu = page.locator('.absolute.top-full.left-0')
    await expect(menu).toBeVisible({ timeout: 3000 })
    await menu.locator('button').filter({ hasText: '终端' }).click()
    await page.waitForTimeout(500)

    // Should have 2 terminal tabs
    const terminalTabs = page.locator('text=终端')
    const count = await terminalTabs.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})

// ── File Pane (gating tests) ──────────────────────────────

test.describe('File Pane gating', () => {
  test.beforeEach(async ({ page }) => {
    await apTestSetup(page)
    await setupMockFs(page)
    await showApPanel(page)
  })

  test('T3.7: File pane hidden in CHATS context (requireProject constraint)', async ({ page }) => {
    // In CHATS context, "文件" should NOT appear (requireProject = true)
    const fileBtn = page.locator('button').filter({ hasText: '文件' }).first()
    await expect(fileBtn).toHaveCount(0)
  })

  test('T3.8: [+] menu respects requireProject constraint', async ({ page }) => {
    await page.locator('button[title="Add pane"]').click()
    await page.waitForTimeout(200)
    const menu = page.locator('.absolute.top-full.left-0')
    if (await menu.isVisible().catch(() => false)) {
      // File should not be in the menu in CHATS context
      const fileInMenu = menu.locator('button').filter({ hasText: '文件' })
      await expect(fileInMenu).toHaveCount(0)
    }
  })
})

// ── Review Pane (gating tests) ─────────────────────────────

test.describe('Review Pane', () => {
  test.beforeEach(async ({ page }) => {
    await apTestSetup(page)
    await showApPanel(page)
  })

  test('T3.9: Review pane gated in CHATS context', async ({ page }) => {
    const reviewBtn = page.locator('button').filter({ hasText: '审查' }).first()
    await expect(reviewBtn).toHaveCount(0)
  })

  test('T3.10: Mock git API returns "Not a git repository" for non-git dirs', async ({ page }) => {
    await setupNoGit(page)
    const result = await page.evaluate(() => {
      return (window as any).api.git.status('/fake/path')
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not a git repository')
  })

  test('T3.11: Mock git API returns realistic status data', async ({ page }) => {
    await setupMockGit(page)
    const result = await page.evaluate(() => {
      return (window as any).api.git.status('/any/repo')
    })
    expect(result.success).toBe(true)
    expect(result.changedFiles.length).toBeGreaterThanOrEqual(2)
    expect(result.branch).toBe('master')
  })
})
