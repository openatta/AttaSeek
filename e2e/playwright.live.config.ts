/**
 * Playwright Live Test Config — Real Electron App + DeepSeek LLM.
 *
 * The live test launches Electron directly via _electron.launch().
 * The renderer is loaded from the built files (out/renderer/index.html).
 * No web server needed.
 *
 * Prerequisites:
 * 1. npm run build (compiles main + preload + renderer)
 * 2. ~/.atta/seek/settings.json with valid LLM provider config
 *
 * Usage:
 *   npx playwright test --config=e2e/playwright.live.config.ts
 */
import { defineConfig } from '@playwright/test'
import path from 'path'

export default defineConfig({
  testDir: './live',
  timeout: 300_000,       // 5 min — real LLM can be slow
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/report-live', open: 'never' }],
  ],
  outputDir: 'e2e/output',
  use: {
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
})
