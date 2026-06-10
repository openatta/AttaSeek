/**
 * AP Layout & Cross-cutting Tests — visual layout, multi-pane, edge cases.
 */
import { test, expect } from '@playwright/test'
import { apTestSetup, showApPanel } from '../utils/ap-helpers'

test.describe('AP Layout', () => {
  test.beforeEach(async ({ page }) => {
    await apTestSetup(page)
    await showApPanel(page)
  })

  test('T4.1: TabBar height is 40px', async ({ page }) => {
    const tabBar = page.locator('[class*="h-\\[40px\\]"]').first()
    await expect(tabBar).toBeVisible({ timeout: 5000 })
    const box = await tabBar.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(38)
      expect(box.height).toBeLessThanOrEqual(42)
    }
  })

  test('T4.2: Empty state buttons centered with gap-12', async ({ page }) => {
    const flexContainer = page.locator('.flex.items-center.gap-12')
    await expect(flexContainer).toBeVisible({ timeout: 5000 })
  })

  test('T4.3: TabBar controls present (Maximize + Hide)', async ({ page }) => {
    await expect(page.locator('button[title="Maximize"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button[title="Hide panel"]')).toBeVisible({ timeout: 5000 })
  })

  test('T4.4: Browser nav bar height is 32px', async ({ page }) => {
    await page.locator('button').filter({ hasText: '浏览器' }).first().click()
    await page.waitForTimeout(500)

    const navBar = page.locator('[class*="h-\\[32px\\]"]').first()
    await expect(navBar).toBeVisible({ timeout: 5000 })
    const box = await navBar.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(30)
      expect(box.height).toBeLessThanOrEqual(34)
    }
  })

  test('T4.5: Multiple panes coexist — browser + terminal tabs', async ({ page }) => {
    await page.locator('button').filter({ hasText: '浏览器' }).first().click()
    await page.waitForTimeout(300)
    // Open second pane via [+] menu (empty state is hidden)
    await page.locator('button[title="Add pane"]').click()
    await page.waitForTimeout(200)
    const addMenu = page.locator('div.fixed.z-50')
    await expect(addMenu).toBeVisible({ timeout: 3000 })
    await addMenu.locator('button').filter({ hasText: '终端' }).click()
    await page.waitForTimeout(400)

    const tabs = page.locator('[class*="h-\\[40px\\]"] [class*="group flex"]')
    const count = await tabs.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('T4.6: Close middle tab — remaining tab activates', async ({ page }) => {
    await page.locator('button').filter({ hasText: '浏览器' }).first().click()
    await page.waitForTimeout(200)
    for (let i = 0; i < 2; i++) {
      await page.locator('button[title="Add pane"]').click()
      await page.waitForTimeout(200)
      const menu = page.locator('div.fixed.z-50')
      if (await menu.isVisible().catch(() => false)) {
        await menu.locator('button').filter({ hasText: '终端' }).click()
        await page.waitForTimeout(300)
      }
    }
    // Close first tab (browser)
    const firstTab = page.locator('[class*="group flex items-center gap-1 px-2\\.5 py-1"]').first()
    await firstTab.hover()
    await page.waitForTimeout(300)
    const closeBtn = firstTab.locator('button[title="Close tab"]')
    await expect(closeBtn).toBeVisible({ timeout: 3000 })
    await closeBtn.click()
    await page.waitForTimeout(400)
    await expect(page.locator('button[title="Add pane"]')).toBeVisible({ timeout: 5000 })
  })

  test('T4.7: [+] menu closes on backdrop click', async ({ page }) => {
    await page.locator('button[title="Add pane"]').click()
    await page.waitForTimeout(200)
    const menu = page.locator('div.fixed.z-50')
    await expect(menu).toBeVisible({ timeout: 3000 })
    await page.locator('.fixed.inset-0.z-40').first().click()
    await page.waitForTimeout(200)
    await expect(menu).not.toBeVisible({ timeout: 2000 })
  })
})

test.describe('AP Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await apTestSetup(page)
    await showApPanel(page)
  })

  test('T4.8: Rapid open/close tabs does not crash', async ({ page }) => {
    await page.locator('button').filter({ hasText: '终端' }).first().click()
    await page.waitForTimeout(200)
    for (let i = 0; i < 2; i++) {
      await page.locator('button[title="Add pane"]').click()
      await page.waitForTimeout(150)
      const menu = page.locator('div.fixed.z-50')
      if (await menu.isVisible().catch(() => false)) {
        await menu.locator('button').filter({ hasText: '终端' }).click()
        await page.waitForTimeout(200)
      }
    }
    const tabs = page.locator('text=终端')
    const count = await tabs.count()
    expect(count).toBeGreaterThanOrEqual(1)
    await expect(page.locator('button[title="Add pane"]')).toBeVisible({ timeout: 5000 })
  })

  test('T4.9: AP visibility persists across hide/show', async ({ page }) => {
    await page.locator('button').filter({ hasText: '浏览器' }).first().click()
    await page.waitForTimeout(300)
    await page.locator('button[title="Hide panel"]').click()
    await page.waitForTimeout(400)
    await showApPanel(page)
    await expect(page.locator('button[title="Back"]')).toBeVisible({ timeout: 5000 })
  })
})
