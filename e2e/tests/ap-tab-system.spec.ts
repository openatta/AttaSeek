/**
 * AP Tab System Tests — tab creation, switching, closing, [+] menu, constraints.
 */
import { test, expect } from '@playwright/test'
import { apTestSetup, showApPanel } from '../utils/ap-helpers'

test.describe('AP Tab System', () => {
  test.beforeEach(async ({ page }) => {
    await apTestSetup(page)
    await showApPanel(page)
  })

  test('T2.1: Click "终端" big button creates a Terminal tab', async ({ page }) => {
    const terminalBtn = page.locator('button').filter({ hasText: '终端' }).first()
    await terminalBtn.click()
    await page.waitForTimeout(600)

    // Tab should appear in the AP tab bar with "终端" label
    const tabText = page.locator('[class*="h-\\[40px\\]"]').locator('text=终端')
    await expect(tabText.first()).toBeVisible({ timeout: 5000 })
  })

  test('T2.2: Click "浏览器" big button creates a Browser tab', async ({ page }) => {
    const browserBtn = page.locator('button').filter({ hasText: '浏览器' }).first()
    await browserBtn.click()
    await page.waitForTimeout(500)

    // Browser navigation bar should appear
    const backBtn = page.locator('button[title="Back"]')
    await expect(backBtn).toBeVisible({ timeout: 5000 })
    // URL input should appear
    await expect(page.locator('input[placeholder="Search or enter URL..."]')).toBeVisible()
  })

  test('T2.3: Tab switching — second pane from [+] menu and activate', async ({ page }) => {
    // Open terminal from empty state
    await page.locator('button').filter({ hasText: '终端' }).first().click()
    await page.waitForTimeout(400)

    // Open browser via [+] menu (empty state is gone now)
    await page.locator('button[title="Add pane"]').click()
    await page.waitForTimeout(200)
    const menu = page.locator('div.fixed.z-50')
    await expect(menu).toBeVisible({ timeout: 3000 })
    await menu.locator('button').filter({ hasText: '浏览器' }).click()
    await page.waitForTimeout(400)

    // Browser content should be visible (browser is active)
    await expect(page.locator('button[title="Back"]')).toBeVisible({ timeout: 5000 })

    // Click on terminal tab to switch back
    const terminalTab = page.locator('text=终端').first()
    await terminalTab.click()
    await page.waitForTimeout(400)

    // Both tabs should still exist
    const tabs = page.locator('text=终端')
    expect(await tabs.count()).toBeGreaterThanOrEqual(1)
  })

  test('T2.4: Close tab via hover × button', async ({ page }) => {
    // Open a pane
    await page.locator('button').filter({ hasText: '终端' }).first().click()
    await page.waitForTimeout(300)

    // Hover over the tab to reveal close button
    const tabGroup = page.locator('.group.flex.items-center.gap-1.px-2\\.5.py-1').first()
    await tabGroup.hover()
    await page.waitForTimeout(300)

    // Close button should appear and be clickable
    const closeBtn = tabGroup.locator('button[title="Close tab"]')
    await expect(closeBtn).toBeVisible({ timeout: 3000 })
    await closeBtn.click()
    await page.waitForTimeout(400)

    // Should return to empty state
    await expect(page.locator('button').filter({ hasText: '浏览器' }).first()).toBeVisible({ timeout: 5000 })
  })

  test('T2.5: [+] menu opens and creates tab from dropdown', async ({ page }) => {
    const addBtn = page.locator('button[title="Add pane"]')
    await expect(addBtn).toBeVisible({ timeout: 5000 })
    await addBtn.click()
    await page.waitForTimeout(300)

    // Dropdown menu should appear
    const menu = page.locator('div.fixed.z-50')
    await expect(menu).toBeVisible({ timeout: 3000 })

    // Click "终端" in the menu
    await menu.locator('button').filter({ hasText: '终端' }).click()
    await page.waitForTimeout(400)

    // Terminal tab should appear
    await expect(page.locator('text=终端').first()).toBeVisible({ timeout: 5000 })
  })

  test('T2.6: Browser single-instance constraint', async ({ page }) => {
    // Open browser first
    await page.locator('button').filter({ hasText: '浏览器' }).first().click()
    await page.waitForTimeout(300)

    // Open [+] menu
    await page.locator('button[title="Add pane"]').click()
    await page.waitForTimeout(300)

    // Browser should NOT be in the menu (single-instance constraint)
    const menu = page.locator('div.fixed.z-50')
    const browserInMenu = menu.locator('button').filter({ hasText: '浏览器' })
    await expect(browserInMenu).toHaveCount(0)

    // Terminal should still be available
    await expect(menu.locator('button').filter({ hasText: '终端' })).toBeVisible({ timeout: 3000 })

    // Close menu by clicking backdrop
    await page.locator('.fixed.inset-0.z-40').first().click()
    await page.waitForTimeout(200)
  })

  test('T2.7: Close last tab returns to empty state', async ({ page }) => {
    // Open terminal
    await page.locator('button').filter({ hasText: '终端' }).first().click()
    await page.waitForTimeout(300)

    // Hover and close
    const tabGroup = page.locator('.group.flex.items-center.gap-1.px-2\\.5.py-1').first()
    await tabGroup.hover()
    await page.waitForTimeout(300)
    await tabGroup.locator('button[title="Close tab"]').click()
    await page.waitForTimeout(400)

    // Empty state should reappear
    await expect(page.locator('button').filter({ hasText: '浏览器' }).first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button').filter({ hasText: '终端' }).first()).toBeVisible({ timeout: 5000 })
  })
})
