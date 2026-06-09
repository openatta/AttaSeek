/**
 * CHATS Session Lifecycle Tests.
 * All tests use mock window.api via direct injection. No real LLM.
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const MOCK_API_PATH = path.resolve(__dirname, '../fixtures/mock-api.js')

test.describe('CHATS Session', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({ path: MOCK_API_PATH })
    await page.goto('/')
    await page.waitForTimeout(2000)
    await page.evaluate(() => (window as any).__mockReset__())
    await page.locator('button[aria-label="New Session"]').first().click()
    await page.waitForTimeout(500)
  })

  test('temp session NOT persisted without API call', async ({ page }) => {
    await expect(page.locator('textarea[placeholder="Ask anything…"]')).toBeVisible({ timeout: 5000 })
    const sessions = await page.evaluate(() => (window as any).__mockGetSessions__())
    expect(sessions.length).toBe(0)
  })

  test('session created via API', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).api.session.create('Hello Test', 'chat', 's-api-1')
    })
    const sessions = await page.evaluate(() => (window as any).__mockGetSessions__())
    expect(sessions.length).toBe(1)
    expect(sessions[0].title).toBe('Hello Test')
  })

  test('session auto-title via SessionTitleGenerated', async ({ page }) => {
    const sid = 'session_auto'
    await page.evaluate((s: string) => {
      (window as any).api.session.create('temp', 'chat', s)
      ;(window as any).__mockEmitEvent__({
        id: 'ev_t', sessionId: s, taskId: 't1', type: 'SessionTitleGenerated',
        payload: { title: 'Quantum Computing Explained' }, createdAt: Date.now(),
      })
    }, sid)
    await page.waitForTimeout(300)
    const evts = await page.evaluate((s: string) => (window as any).api.agent.listEvents(s), sid)
    expect(evts.events.some((e: any) => e.type === 'SessionTitleGenerated')).toBeTruthy()
  })

  test('search filters sessions', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__mockAddSession__({ id: 's1', title: 'React Components', activity: 'chat', createdAt: Date.now(), updatedAt: Date.now() })
      ;(window as any).__mockAddSession__({ id: 's2', title: 'Python Script', activity: 'chat', createdAt: Date.now(), updatedAt: Date.now() })
      ;(window as any).__mockAddSession__({ id: 's3', title: 'Debug Session', activity: 'chat', createdAt: Date.now(), updatedAt: Date.now() })
    })
    await page.reload()
    await page.addInitScript({ path: MOCK_API_PATH })
    await page.goto('/')
    await page.waitForTimeout(2000)
    await page.evaluate(() => {
      (window as any).__mockAddSession__({ id: 's1', title: 'React Components', activity: 'chat', createdAt: Date.now(), updatedAt: Date.now() })
      ;(window as any).__mockAddSession__({ id: 's2', title: 'Python Script', activity: 'chat', createdAt: Date.now(), updatedAt: Date.now() })
      ;(window as any).__mockAddSession__({ id: 's3', title: 'Debug Session', activity: 'chat', createdAt: Date.now(), updatedAt: Date.now() })
    })
    await page.locator('button[aria-label="New Session"]').first().click()
    await page.waitForTimeout(500)

    const searchInput = page.locator('input[placeholder*="search" i]').first()
    await searchInput.waitFor({ state: 'visible', timeout: 5000 })
    await searchInput.fill('Python')
    await page.waitForTimeout(300)

    // Python Script should be filtered in, React Components hidden
    const pythonBtn = page.locator('button').filter({ hasText: 'Python Script' }).first()
    const reactBtn = page.locator('button').filter({ hasText: 'React Components' }).first()
    expect(await pythonBtn.isVisible().catch(() => false)).toBeTruthy()
    expect(await reactBtn.isVisible().catch(() => false)).toBeFalsy()
  })

  test('rename session', async ({ page }) => {
    await page.evaluate(() => (window as any).__mockAddSession__({ id: 's-rn', title: 'Old', activity: 'chat', createdAt: Date.now(), updatedAt: Date.now() }))
    await page.evaluate(() => (window as any).api.session.update('s-rn', { title: 'New Title' }))
    const s = await page.evaluate(() => (window as any).api.session.get('s-rn'))
    expect(s.session.title).toBe('New Title')
  })

  test('delete session', async ({ page }) => {
    await page.evaluate(() => (window as any).__mockAddSession__({ id: 's-del', title: 'Delete Me', activity: 'chat', createdAt: Date.now(), updatedAt: Date.now() }))
    await page.evaluate(() => (window as any).api.session.delete('s-del'))
    expect(await page.evaluate(() => (window as any).__mockGetSessions__().length)).toBe(0)
  })

  test('global cleanup — delete all sessions', async ({ page }) => {
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) {
        ;(window as any).__mockAddSession__({ id: `sc${i}`, title: `Session ${i}`, activity: 'chat', createdAt: Date.now(), updatedAt: Date.now() })
      }
    })
    await page.evaluate(async () => {
      const res = await (window as any).api.session.list()
      for (const s of res.sessions) await (window as any).api.session.delete(s.id)
    })
    expect(await page.evaluate(() => (window as any).__mockGetSessions__().length)).toBe(0)
  })
})
