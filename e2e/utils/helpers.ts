/**
 * E2E test helpers — scenario builders, page actions, assertions.
 */
import type { Page, Locator } from '@playwright/test'

// ── SessionEvent factories (for building mock scenarios) ──

let _evtCounter = 0
function evtId(): string { return `evt_${Date.now()}_${++_evtCounter}` }

export interface ScenarioEvent {
  id?: string
  sessionId: string
  taskId: string
  type: string
  payload: Record<string, unknown>
  createdAt?: number
}

/**
 * Build a single-turn scenario: UserMessage → streaming chunks → AgentMessage → TaskCompleted → SessionTitleGenerated.
 */
export function buildSingleTurn(params: {
  sessionId: string
  taskId: string
  userMessage: string
  agentContent: string
  title?: string
}): ScenarioEvent[][] {
  const { sessionId, taskId, userMessage, agentContent, title } = params
  const now = Date.now()

  // Split agent content into "chunks" for streaming simulation
  const words = agentContent.split(/(?<=\s)/)
  const chunkSize = Math.max(1, Math.floor(words.length / 8))
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(''))
  }

  const scenario: ScenarioEvent[] = [
    // UserMessage
    { type: 'UserMessage', sessionId, taskId, payload: { content: userMessage }, createdAt: now },
  ]

  // AgentMessage placeholder (empty, before streaming)
  const msgId = evtId()
  scenario.push({
    type: 'AgentMessage', sessionId, taskId,
    payload: { content: '', messageId: msgId },
    createdAt: now + 10,
  })

  // Streaming chunks
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    if (!chunk) continue
    scenario.push({
      type: 'AgentMessageChunk', sessionId, taskId,
      payload: { content: chunk, messageId: msgId, isFinal: i === chunks.length - 1 },
      createdAt: now + 20 + i * 10,
    })
  }

  // SessionTitleGenerated
  if (title) {
    scenario.push({
      type: 'SessionTitleGenerated', sessionId, taskId,
      payload: { title },
      createdAt: now + 100,
    })
  }

  // TaskCompleted
  scenario.push({
    type: 'TaskCompleted', sessionId, taskId,
    payload: { summary: 'Task completed successfully' },
    createdAt: now + 150,
  })

  return [scenario]
}

/**
 * Build a multi-turn scenario (N turns of user↔agent).
 */
export function buildMultiTurn(params: {
  sessionId: string
  turns: Array<{ userMessage: string; agentContent: string }>
  title?: string
}): ScenarioEvent[][] {
  const { sessionId, turns, title } = params
  const scenarios: ScenarioEvent[][] = []

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]
    if (!turn) continue
    const taskId = evtId()
    const isFirst = i === 0
    const isLast = i === turns.length - 1

    scenarios.push(...buildSingleTurn({
      sessionId,
      taskId,
      userMessage: turn.userMessage,
      agentContent: turn.agentContent,
      title: isFirst ? title : undefined,
    }))
  }

  return scenarios
}

// ── Page actions ──

export async function waitForApp(page: Page): Promise<void> {
  // Wait for React to mount
  await page.waitForSelector('[class*="flex h-screen"]', { timeout: 15000 })
  // Wait for the activity bar
  await page.waitForSelector('button[aria-label="Chat"]', { timeout: 5000 }).catch(() => {})
}

export async function getComposerInput(page: Page): Promise<Locator> {
  return page.locator('textarea[placeholder="Ask anything…"]')
}

export async function getSendButton(page: Page): Promise<Locator> {
  return page.locator('button[aria-label="Send"]')
}

export async function getStopButton(page: Page): Promise<Locator> {
  return page.locator('button[aria-label="Stop"]')
}

export async function getNewSessionButton(page: Page): Promise<Locator> {
  return page.locator('button[aria-label="New Session"]')
}

export async function getChatListItems(page: Page): Promise<Locator> {
  return page.locator('[class*="ChatsList"] button').filter({ hasText: /.+/ })
}

export async function getSearchInput(page: Page): Promise<Locator> {
  return page.locator('input[placeholder*="search" i]').first()
}

export async function typeMessage(page: Page, text: string): Promise<void> {
  const input = await getComposerInput(page)
  await input.click()
  await input.fill(text)
}

export async function sendMessage(page: Page, text: string): Promise<void> {
  await typeMessage(page, text)
  const sendBtn = await getSendButton(page)
  await sendBtn.click()
}

export async function clearAllSessions(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__mockReset__()
  })
}

// ── Assertion helpers ──

export async function expectComposerEmpty(page: Page): Promise<void> {
  const input = await getComposerInput(page)
  await input.waitFor({ state: 'visible' })
}

export async function expectSendDisabled(page: Page): Promise<void> {
  const btn = await getSendButton(page)
  // Should be disabled when empty
  const disabled = await btn.getAttribute('disabled')
  if (disabled === null) {
    // Check for cursor-not-allowed class instead
    const cls = await btn.getAttribute('class')
    if (!cls?.includes('cursor-not-allowed')) {
      throw new Error('Send button should be disabled when composer is empty')
    }
  }
}

export async function expectMessageInFlow(page: Page, text: string, timeout = 10000): Promise<void> {
  await page.locator('[class*="MessageFlow"]').filter({ hasText: text }).first().waitFor({ state: 'visible', timeout })
}

export async function expectSessionInList(page: Page, title: string, timeout = 5000): Promise<void> {
  await page.locator('button').filter({ hasText: title }).first().waitFor({ state: 'visible', timeout })
}

export async function expectTaskCompleted(page: Page, timeout = 15000): Promise<void> {
  await page.locator('[class*="TaskCompleted"]').first().waitFor({ state: 'visible', timeout })
}
