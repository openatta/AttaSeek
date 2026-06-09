/**
 * CHATS Composer Tests — input, buttons, permission, reasoning, suggestions.
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const MOCK_API_PATH = path.resolve(__dirname, '../fixtures/mock-api.js')

test.describe('CHATS Composer', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({ path: MOCK_API_PATH })
    await page.goto('/')
    await page.waitForTimeout(2000)
    await page.evaluate(() => (window as any).__mockReset__())
    await page.locator('button[aria-label="New Session"]').first().click()
    await page.waitForTimeout(500)
  })

  test('send disabled when empty', async ({ page }) => {
    const sendBtn = page.locator('button[aria-label="Send"]')
    await sendBtn.waitFor({ state: 'visible', timeout: 5000 })
    const cls = await sendBtn.getAttribute('class')
    expect(cls?.includes('cursor-not-allowed')).toBeTruthy()
  })

  test('send enabled with text', async ({ page }) => {
    await page.locator('textarea[placeholder="Ask anything…"]').fill('Test')
    await page.waitForTimeout(300)
    const cls = await page.locator('button[aria-label="Send"]').getAttribute('class')
    expect(cls?.includes('cursor-not-allowed')).toBeFalsy()
  })

  test('Shift+Enter inserts newline', async ({ page }) => {
    const input = page.locator('textarea[placeholder="Ask anything…"]')
    await input.fill('Line 1')
    await input.press('Shift+Enter')
    await page.waitForTimeout(200)
    expect(await input.inputValue()).toContain('\n')
  })

  test('permission cycles Default→Auto→Trust→Default', async ({ page }) => {
    const permBtn = page.locator('button').filter({ hasText: /Default Review|Auto Review|Full Trust/ }).first()
    await permBtn.waitFor({ state: 'visible', timeout: 5000 })
    const initial = await permBtn.textContent()
    await permBtn.click(); await page.waitForTimeout(200)
    expect(await permBtn.textContent()).not.toBe(initial)
    await permBtn.click(); await page.waitForTimeout(200)
    await permBtn.click(); await page.waitForTimeout(200)
    expect(await permBtn.textContent()).toBe(initial)
  })

  test('reasoning button present and clickable', async ({ page }) => {
    const btn = page.locator('button').filter({ hasText: 'Reasoning' }).first()
    await btn.waitFor({ state: 'visible', timeout: 5000 })
    // Verify button exists and can be clicked without error
    await btn.click()
    await page.waitForTimeout(100)
    // Should still exist after click
    await expect(btn).toBeVisible()
  })

  test('suggestion fills composer', async ({ page }) => {
    const sug = page.locator('button').filter({ hasText: 'Explain quantum computing' })
    if (await sug.isVisible().catch(() => false)) {
      await sug.click()
      await page.waitForTimeout(300)
      expect(await page.locator('textarea[placeholder="Ask anything…"]').inputValue()).toContain('quantum')
    }
  })

  test('composer persists across activity switches', async ({ page }) => {
    await page.locator('textarea[placeholder="Ask anything…"]').fill('Chat text')
    await page.locator('button[aria-label="Home"]').click()
    await page.waitForTimeout(500)
    await page.locator('button[aria-label="New Session"]').first().click()
    await page.waitForTimeout(500)
    expect(await page.locator('textarea[placeholder="Ask anything…"]').inputValue()).toBe('Chat text')
  })

  test('createTask creates session and task', async ({ page }) => {
    const result = await page.evaluate(() =>
      (window as any).api.agent.createTask('API test task', 'sess_cmp')
    )
    expect(result.success).toBeTruthy()
    expect(result.task.goal).toBe('API test task')
    const sessions = await page.evaluate(() => (window as any).__mockGetSessions__())
    expect(sessions.some((s: any) => s.title.includes('API test'))).toBeTruthy()
  })

  test('cancelTask sets status to cancelled', async ({ page }) => {
    const { task } = await page.evaluate(() =>
      (window as any).api.agent.createTask('Cancel me', 'sess_cancel')
    )
    await page.evaluate((tid: string) => (window as any).api.agent.cancelTask(tid), task.id)
    const t = await page.evaluate((tid: string) => (window as any).api.agent.getTask(tid), task.id)
    expect(t.task.status).toBe('cancelled')
  })
})
