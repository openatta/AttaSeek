/**
 * AP Panel Lifecycle Tests — show/hide, fullscreen, empty state, context gating.
 */
import { test, expect } from '@playwright/test'
import { apTestSetup, showApPanel } from '../utils/ap-helpers'

test.describe('AP Panel Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await apTestSetup(page)
  })

  test('T1.1: AP toggle button visible in Chat workspace', async ({ page }) => {
    // After entering chat workspace, the "Show output area" button should be visible
    const showBtn = page.locator('button[aria-label="Show output area"]')
    await expect(showBtn).toBeVisible({ timeout: 10000 })
  })

  test('T1.2: Show AP panel reveals empty state with big buttons', async ({ page }) => {
    await showApPanel(page)
    // Empty state should show big buttons (CHATS context → browser, terminal)
    const browserBtn = page.locator('button').filter({ hasText: '浏览器' })
    const terminalBtn = page.locator('button').filter({ hasText: '终端' })
    await expect(browserBtn.first()).toBeVisible({ timeout: 8000 })
    await expect(terminalBtn.first()).toBeVisible({ timeout: 8000 })
  })

  test('T1.3: CHATS context shows only browser+terminal (not file/review)', async ({ page }) => {
    await showApPanel(page)
    // 文件 and 审查 should NOT appear in CHATS context (requireProject constraint)
    const fileBtn = page.locator('button').filter({ hasText: '文件' })
    const reviewBtn = page.locator('button').filter({ hasText: '审查' })
    await expect(fileBtn).toHaveCount(0)
    await expect(reviewBtn).toHaveCount(0)
  })

  test('T1.4: Big buttons have 64px icon area (w-16 h-16)', async ({ page }) => {
    await showApPanel(page)
    const iconContainers = page.locator('.w-16.h-16')
    const count = await iconContainers.count()
    expect(count).toBeGreaterThanOrEqual(2) // browser + terminal
  })

  test('T1.5: Hide AP panel via toggle', async ({ page }) => {
    await showApPanel(page)
    // Click hide button
    const hideBtn = page.locator('button[title="Hide panel"]')
    await expect(hideBtn).toBeVisible({ timeout: 5000 })
    await hideBtn.click()
    await page.waitForTimeout(400)
    // After hiding, "Show output area" button should reappear
    await expect(page.locator('button[aria-label="Show output area"]')).toBeVisible({ timeout: 5000 })
  })

  test('T1.6: Fullscreen toggle', async ({ page }) => {
    await showApPanel(page)
    const maxBtn = page.locator('button[title="Maximize"]')
    await expect(maxBtn).toBeVisible({ timeout: 5000 })
    await maxBtn.click()
    await page.waitForTimeout(300)
    // Title should change after maximizing
    await expect(page.locator('button[title="Restore size"]')).toBeVisible({ timeout: 3000 })
    // Click again to restore
    await page.locator('button[title="Restore size"]').click()
    await page.waitForTimeout(300)
    await expect(page.locator('button[title="Maximize"]')).toBeVisible({ timeout: 3000 })
  })
})
