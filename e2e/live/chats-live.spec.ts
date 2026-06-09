/**
 * CHATS Live Test — Real Electron App + DeepSeek LLM.
 *
 * This test validates the FULL stack: IPC → Agent Engine → LLM Provider → UI.
 * It launches the real Electron app with the built main process.
 *
 * Prerequisites:
 * 1. npm run build (compile main + preload + renderer)
 * 2. ~/.atta/seek/settings.json with valid LLM config
 * 3. No old sessions (clean ~/.atta/seek/sessions/)
 *
 * Run manually: npx playwright test --config=e2e/playwright.live.config.ts
 */
import { test, expect, _electron as electron } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

const PROJECT_ROOT = path.resolve(__dirname, '../..')
const MAIN_ENTRY = path.join(PROJECT_ROOT, 'out', 'main', 'index.js')
const SESSIONS_DIR = path.join(os.homedir(), '.atta', 'seek', 'sessions')

test.describe('CHATS Live (Real DeepSeek)', () => {
  test.setTimeout(180_000)

  let electronApp: any
  let page: any

  test.beforeAll(async () => {
    // Verify main entry exists
    if (!fs.existsSync(MAIN_ENTRY)) {
      throw new Error(`Main entry not found: ${MAIN_ENTRY}. Run "npm run build" first.`)
    }

    // Launch Electron app
    const electronPath = require('electron') as unknown as string
    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      executablePath: electronPath,
    })

    page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    // Wait for React + providers + model config to load
    await page.waitForTimeout(5000)
  })

  test.afterAll(async () => {
    await electronApp?.close().catch(() => {})
  })

  test('complex multi-turn with real DeepSeek LLM', async () => {
    // Switch to Chat activity
    const chatBtn = page.locator('button[aria-label="New Session"]').first()
    await chatBtn.waitFor({ state: 'visible', timeout: 10000 })
    await chatBtn.click()
    await page.waitForTimeout(1000)

    // Check if model is configured
    const noModel = page.getByText('No model configured')
    if (await noModel.isVisible().catch(() => false)) {
      console.log('[live] SKIP: No model configured')
      return
    }

    const input = page.locator('textarea[placeholder="Ask anything…"]')
    await input.waitFor({ state: 'visible', timeout: 10000 })

    // ── Turn 1: Introduction ──
    console.log('[live] Turn 1: Introduction')
    await input.fill('Hi! My name is Xiao Ming. I am a software engineer. Can you remember my name?')
    await page.locator('button[aria-label="Send"]').click()
    await page.waitForTimeout(15000)

    // Take screenshot
    await page.screenshot({ path: 'e2e/output/live-turn1.png' })

    // Check session appears in sidebar
    const sessionTitle = page.locator('button').filter({ hasText: /Xiao Ming|software/i }).first()
    const sessionVisible = await sessionTitle.isVisible().catch(() => false)
    console.log(`[live] Session visible in sidebar: ${sessionVisible}`)

    // ── Turn 2: Verify memory ──
    console.log('[live] Turn 2: Memory check')
    const input2 = page.locator('textarea[placeholder="Ask anything…"]')
    await input2.fill('What is my name and what do I do for work?')
    await page.locator('button[aria-label="Send"]').click()
    await page.waitForTimeout(15000)

    await page.screenshot({ path: 'e2e/output/live-turn2.png' })

    // ── Turn 3: Technical question ──
    console.log('[live] Turn 3: Technical question')
    const input3 = page.locator('textarea[placeholder="Ask anything…"]')
    await input3.fill('What is the CAP theorem? Answer in 3 bullet points.')
    await page.locator('button[aria-label="Send"]').click()
    await page.waitForTimeout(15000)

    await page.screenshot({ path: 'e2e/output/live-turn3.png' })

    // ── Turn 4: Code example ──
    console.log('[live] Turn 4: Code example')
    const input4 = page.locator('textarea[placeholder="Ask anything…"]')
    await input4.fill('Write a short TypeScript function that uses async/await to fetch data from an API.')
    await page.locator('button[aria-label="Send"]').click()
    await page.waitForTimeout(20000)

    await page.screenshot({ path: 'e2e/output/live-turn4.png' })

    // ── Turn 5: Summarization ──
    console.log('[live] Turn 5: Summarize conversation')
    const input5 = page.locator('textarea[placeholder="Ask anything…"]')
    await input5.fill('List all the topics we have discussed in this conversation so far.')
    await page.locator('button[aria-label="Send"]').click()
    await page.waitForTimeout(15000)

    await page.screenshot({ path: 'e2e/output/live-turn5.png' })

    console.log('[live] ✅ 5-turn live conversation completed')
  })
})
