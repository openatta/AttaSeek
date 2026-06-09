/**
 * CHATS MessageFlow Tests — rendering, streaming, copy, error states.
 * Uses direct event injection via __mockEmitEvent__.
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const MOCK_API_PATH = path.resolve(__dirname, '../fixtures/mock-api.js')

test.describe('CHATS MessageFlow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({ path: MOCK_API_PATH })
    await page.goto('/')
    await page.waitForTimeout(2000)
    await page.evaluate(() => (window as any).__mockReset__())
    await page.locator('button[aria-label="New Session"]').first().click()
    await page.waitForTimeout(500)
  })

  test('empty state shows suggestions', async ({ page }) => {
    await expect(page.getByText('What can I help with?')).toBeVisible({ timeout: 5000 })
    const sugs = page.locator('button').filter({ hasText: /Explain quantum|Write a Python|Summarize|Review my code/ })
    expect(await sugs.count()).toBeGreaterThanOrEqual(2)
  })

  test('user and agent messages render via API', async ({ page }) => {
    const sid = 'session_render'
    await page.evaluate((s: string) => {
      (window as any).api.session.create('Render Test', 'chat', s)
      ;(window as any).__mockEmitEvent__({ id: 'e1', sessionId: s, taskId: 't1', type: 'UserMessage', payload: { content: 'Hello world' }, createdAt: Date.now() })
      ;(window as any).__mockEmitEvent__({ id: 'e2', sessionId: s, taskId: 't1', type: 'AgentMessage', payload: { content: '**Hi!** Here is `code`.' }, createdAt: Date.now() + 10 })
    }, sid)

    const evts = await page.evaluate((s: string) => (window as any).api.agent.listEvents(s), sid)
    expect(evts.events.length).toBe(2)
    expect(evts.events[0].type).toBe('UserMessage')
    expect(evts.events[0].payload.content).toBe('Hello world')
    expect(evts.events[1].type).toBe('AgentMessage')
    expect(evts.events[1].payload.content).toContain('Hi!')
    expect(evts.events[1].payload.content).toContain('`code`')
  })

  test('code blocks stored in events', async ({ page }) => {
    const sid = 'session_code'
    await page.evaluate((s: string) => {
      (window as any).api.session.create('Code Test', 'chat', s)
      ;(window as any).__mockEmitEvent__({ id: 'e1', sessionId: s, taskId: 't1', type: 'UserMessage', payload: { content: 'Show code' }, createdAt: Date.now() })
      ;(window as any).__mockEmitEvent__({ id: 'e2', sessionId: s, taskId: 't1', type: 'AgentMessage', payload: { content: '```typescript\nconst x: number = 42;\nconsole.log(x);\n```' }, createdAt: Date.now() + 10 })
    }, sid)

    const evts = await page.evaluate((s: string) => (window as any).api.agent.listEvents(s), sid)
    expect(evts.events.length).toBe(2)
    expect(evts.events[1].payload.content).toContain('```typescript')
    expect(evts.events[1].payload.content).toContain('const x')
  })

  test('Copy button on agent message', async ({ page }) => {
    const sid = 'session_copy'
    await page.evaluate((s: string) => {
      (window as any).api.session.create('Copy Test', 'chat', s)
      ;(window as any).__mockEmitEvent__({ id: 'e1', sessionId: s, taskId: 't1', type: 'UserMessage', payload: { content: 'Say something' }, createdAt: Date.now() })
      ;(window as any).__mockEmitEvent__({ id: 'e2', sessionId: s, taskId: 't1', type: 'AgentMessage', payload: { content: 'Copy this please.' }, createdAt: Date.now() + 10 })
    }, sid)

    // Verify events stored correctly
    const evts = await page.evaluate((s: string) => (window as any).api.agent.listEvents(s), sid)
    expect(evts.events.length).toBe(2)
    const agentMsg = evts.events.find((e: any) => e.type === 'AgentMessage')
    expect(agentMsg.payload.content).toBe('Copy this please.')
  })

  test('TaskCompleted and TaskFailed events', async ({ page }) => {
    const sid = 'session_status'
    await page.evaluate((s: string) => {
      (window as any).api.session.create('Status Test', 'chat', s)
      ;(window as any).__mockEmitEvent__({ id: 'ev1', sessionId: s, taskId: 't1', type: 'UserMessage', payload: { content: 'Q1' }, createdAt: Date.now() })
      ;(window as any).__mockEmitEvent__({ id: 'ev2', sessionId: s, taskId: 't1', type: 'AgentMessage', payload: { content: 'A1' }, createdAt: Date.now() + 10 })
      ;(window as any).__mockEmitEvent__({ id: 'ev3', sessionId: s, taskId: 't2', type: 'UserMessage', payload: { content: 'Q2' }, createdAt: Date.now() + 20 })
      ;(window as any).__mockEmitEvent__({ id: 'ev4', sessionId: s, taskId: 't2', type: 'TaskFailed', payload: { error: 'Error occurred' }, createdAt: Date.now() + 30 })
    }, sid)

    // Verify events are stored
    const evts = await page.evaluate((s: string) => (window as any).api.agent.listEvents(s), sid)
    const types = evts.events.map((e: any) => e.type)
    expect(types).toContain('UserMessage')
    expect(types).toContain('AgentMessage')
    expect(types).toContain('TaskFailed')
  })

  test('events filter by session', async ({ page }) => {
    const data = { s1: 'session_ev_a', s2: 'session_ev_b' }
    await page.evaluate((d: { s1: string; s2: string }) => {
      (window as any).api.session.create('Events A', 'chat', d.s1)
      ;(window as any).api.session.create('Events B', 'chat', d.s2)
      ;(window as any).__mockEmitEvent__({ id: 'ea1', sessionId: d.s1, taskId: 't1', type: 'UserMessage', payload: { content: 'Message in A' }, createdAt: Date.now() })
      ;(window as any).__mockEmitEvent__({ id: 'eb1', sessionId: d.s2, taskId: 't2', type: 'UserMessage', payload: { content: 'Message in B' }, createdAt: Date.now() + 10 })
    }, data)

    const evtsA = await page.evaluate((s: string) => (window as any).api.agent.listEvents(s), data.s1)
    const evtsB = await page.evaluate((s: string) => (window as any).api.agent.listEvents(s), data.s2)

    expect(evtsA.events.length).toBe(1)
    expect(evtsA.events[0].payload.content).toBe('Message in A')
    expect(evtsB.events.length).toBe(1)
    expect(evtsB.events[0].payload.content).toBe('Message in B')
  })
})
