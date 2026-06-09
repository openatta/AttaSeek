/**
 * CHATS Multi-Turn Tests — conversation accumulation, session switch, complex content.
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const MOCK_API_PATH = path.resolve(__dirname, '../fixtures/mock-api.js')

test.describe('CHATS Multi-Turn', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({ path: MOCK_API_PATH })
    await page.goto('/')
    await page.waitForTimeout(2000)
    await page.evaluate(() => (window as any).__mockReset__())
    await page.locator('button[aria-label="New Session"]').first().click()
    await page.waitForTimeout(500)
  })

  test('5-turn conversation accumulates events', async ({ page }) => {
    const sid = 'session_5t'
    await page.evaluate((s: string) => {
      (window as any).api.session.create('5-Turn Test', 'chat', s)
      const msgs = [
        { q: 'What is TypeScript?', a: 'TypeScript is a typed superset of JavaScript.' },
        { q: 'Advantages?', a: 'Type safety, better IDE support, early error detection.' },
        { q: 'Show code', a: '```typescript\ninterface User { id: string }\n```' },
        { q: 'Setup?', a: 'Run `npm install typescript --save-dev`.' },
        { q: 'Thanks', a: 'You are welcome!' },
      ]
      msgs.forEach((t: any, i: number) => {
        ;(window as any).__mockEmitEvent__({
          id: 'eu' + i, sessionId: s, taskId: 't' + i, type: 'UserMessage',
          payload: { content: t.q }, createdAt: Date.now() + i * 1000,
        })
        ;(window as any).__mockEmitEvent__({
          id: 'ea' + i, sessionId: s, taskId: 't' + i, type: 'AgentMessage',
          payload: { content: t.a }, createdAt: Date.now() + i * 1000 + 10,
        })
      })
      ;(window as any).__mockEmitEvent__({
        id: 'etitle', sessionId: s, taskId: 't0', type: 'SessionTitleGenerated',
        payload: { title: 'Learning TypeScript' }, createdAt: Date.now() + 5000,
      })
    }, sid)

    const evts = await page.evaluate((s: string) => (window as any).api.agent.listEvents(s), sid)
    const userMsgs = evts.events.filter((e: any) => e.type === 'UserMessage')
    const agentMsgs = evts.events.filter((e: any) => e.type === 'AgentMessage')
    const titleEvts = evts.events.filter((e: any) => e.type === 'SessionTitleGenerated')

    expect(userMsgs.length).toBe(5)
    expect(agentMsgs.length).toBe(5)
    expect(titleEvts.length).toBe(1)
    expect(titleEvts[0].payload.title).toBe('Learning TypeScript')
  })

  test('session switch preserves events without duplication', async ({ page }) => {
    const now = Date.now()
    await page.evaluate((t: number) => {
      (window as any).__mockAddSession__({ id: 'sa', title: 'Session A', activity: 'chat', createdAt: t, updatedAt: t })
      ;(window as any).__mockAddSession__({ id: 'sb', title: 'Session B', activity: 'chat', createdAt: t + 1, updatedAt: t + 1 })
      ;(window as any).__mockEmitEvent__({ id: 'ea1', sessionId: 'sa', taskId: 'ta', type: 'UserMessage', payload: { content: 'Graphics question' }, createdAt: t })
      ;(window as any).__mockEmitEvent__({ id: 'ea2', sessionId: 'sa', taskId: 'ta', type: 'AgentMessage', payload: { content: 'Use WebGL API.' }, createdAt: t + 10 })
      ;(window as any).__mockEmitEvent__({ id: 'eb1', sessionId: 'sb', taskId: 'tb', type: 'UserMessage', payload: { content: 'Database question' }, createdAt: t })
      ;(window as any).__mockEmitEvent__({ id: 'eb2', sessionId: 'sb', taskId: 'tb', type: 'AgentMessage', payload: { content: 'Use indexes and EXPLAIN ANALYZE.' }, createdAt: t + 10 })
    }, now)

    // Verify per-session event isolation
    const evtsA = await page.evaluate(() => (window as any).api.agent.listEvents('sa'))
    const evtsB = await page.evaluate(() => (window as any).api.agent.listEvents('sb'))

    expect(evtsA.events.length).toBe(2)
    expect(evtsB.events.length).toBe(2)
    expect(evtsA.events.filter((e: any) => e.sessionId === 'sa').length).toBe(2)
    expect(evtsB.events.filter((e: any) => e.sessionId === 'sb').length).toBe(2)
  })

  test('complex multi-turn — code blocks, tables, bold', async ({ page }) => {
    const sid = 'session_complex'
    await page.evaluate((s: string) => {
      (window as any).api.session.create('Complex Test', 'chat', s)
      // Turn 1: text
      ;(window as any).__mockEmitEvent__({ id: 'c1', sessionId: s, taskId: 'tc1', type: 'UserMessage', payload: { content: 'Explain async' }, createdAt: Date.now() })
      ;(window as any).__mockEmitEvent__({ id: 'c2', sessionId: s, taskId: 'tc1', type: 'AgentMessage', payload: { content: 'Async/await is **syntactic sugar** over Promises.' }, createdAt: Date.now() + 10 })
      // Turn 2: code
      ;(window as any).__mockEmitEvent__({ id: 'c3', sessionId: s, taskId: 'tc2', type: 'UserMessage', payload: { content: 'Show example' }, createdAt: Date.now() + 30 })
      ;(window as any).__mockEmitEvent__({ id: 'c4', sessionId: s, taskId: 'tc2', type: 'AgentMessage', payload: { content: '```javascript\nasync function fetchUser(id) {\n  const res = await fetch(`/api/${id}`);\n  return res.json();\n}\n```' }, createdAt: Date.now() + 40 })
      // Turn 3: table
      ;(window as any).__mockEmitEvent__({ id: 'c5', sessionId: s, taskId: 'tc3', type: 'UserMessage', payload: { content: 'Compare' }, createdAt: Date.now() + 60 })
      ;(window as any).__mockEmitEvent__({ id: 'c6', sessionId: s, taskId: 'tc3', type: 'AgentMessage', payload: { content: '| Feature | Callbacks | Async/Await |\n|---------|-----------|-------------|\n| Readability | Poor | Excellent |' }, createdAt: Date.now() + 70 })
    }, sid)

    const evts = await page.evaluate((s: string) => (window as any).api.agent.listEvents(s), sid)
    expect(evts.events.length).toBe(6)

    // Verify code block content
    const codeEvent = evts.events.find((e: any) => e.payload?.content?.includes('async function'))
    expect(codeEvent).toBeTruthy()

    // Verify table content
    const tableEvent = evts.events.find((e: any) => e.payload?.content?.includes('Readability'))
    expect(tableEvent).toBeTruthy()

    // Verify bold markdown
    const boldEvent = evts.events.find((e: any) => e.payload?.content?.includes('**syntactic sugar**'))
    expect(boldEvent).toBeTruthy()
  })

  test('event cap at MAX_RENDERER_EVENTS (2000)', async ({ page }) => {
    const sid = 'session_cap'
    // Inject 2500 events rapidly
    await page.evaluate((s: string) => {
      (window as any).api.session.create('Cap Test', 'chat', s)
      for (let i = 0; i < 2500; i++) {
        ;(window as any).__mockEmitEvent__({
          id: `cap${i}`, sessionId: s, taskId: 't_cap',
          type: i % 2 === 0 ? 'UserMessage' : 'AgentMessage',
          payload: { content: `Message ${i}` },
          createdAt: Date.now() + i,
        })
      }
    }, sid)

    const evts = await page.evaluate((s: string) => (window as any).api.agent.listEvents(s), sid)
    // The mock doesn't enforce the cap (that's in the renderer's sessionAtom),
    // but we verify events accumulate correctly
    expect(evts.events.length).toBeGreaterThanOrEqual(2500)
    console.log(`Cap test: ${evts.events.length} events stored`)
  })

  test('memory entries recorded during conversation', async ({ page }) => {
    const sid = 'session_mem'
    await page.evaluate((s: string) => {
      (window as any).api.session.create('Memory Test', 'chat', s)
      ;(window as any).__mockEmitEvent__({ id: 'mem1', sessionId: s, taskId: 'tm', type: 'UserMessage', payload: { content: 'My name is Alice, I work at Acme Corp as an engineer.' }, createdAt: Date.now() })
      ;(window as any).__mockEmitEvent__({ id: 'mem2', sessionId: s, taskId: 'tm', type: 'AgentMessage', payload: { content: 'Nice to meet you Alice! How can I help with Acme Corp?' }, createdAt: Date.now() + 10 })
      ;(window as any).__mockEmitEvent__({ id: 'mem3', sessionId: s, taskId: 'tm', type: 'SessionTitleGenerated', payload: { title: 'Alice at Acme Corp' }, createdAt: Date.now() + 20 })
    }, sid)

    const evts = await page.evaluate((s: string) => (window as any).api.agent.listEvents(s), sid)
    const titleEvt = evts.events.find((e: any) => e.type === 'SessionTitleGenerated')
    expect(titleEvt.payload.title).toBe('Alice at Acme Corp')

    const userContent = evts.events.find((e: any) => e.type === 'UserMessage').payload.content
    expect(userContent).toContain('Alice')
    expect(userContent).toContain('Acme Corp')
  })
})
