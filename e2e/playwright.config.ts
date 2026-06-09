/**
 * Playwright E2E config for AttaSeek CHATS tests.
 *
 * Two projects:
 * 1. mock — static serve built renderer + mock window.api (fast, no LLM)
 * 2. live — full Electron app with real LLM (slow, needs API key)
 *
 * Usage:
 *   npm run test:e2e                    # all mock tests
 *   npm run test:e2e -- --project=mock  # mock only
 *   npm run test:e2e -- --project=live  # live only
 */
import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const RENDERER_URL = process.env['RENDERER_URL'] || 'http://localhost:5199'

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/report', open: 'never' }],
  ],
  outputDir: 'e2e/output',

  use: {
    baseURL: RENDERER_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'mock',
      testMatch: /^(?!.*live\.spec\.ts).*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: RENDERER_URL,
        launchOptions: {
          args: ['--disable-web-security'],
        },
      },
    },
    {
      name: 'live',
      testMatch: /live\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: RENDERER_URL,
      },
    },
  ],

  // Static file server for mock tests (serves built renderer)
  // For live tests, use a separate config that starts electron-vite
  webServer: {
    command: 'node e2e/server.js',
    port: 5199,
    timeout: 10000,
    reuseExistingServer: !process.env['CI'],
    cwd: path.resolve(__dirname, '..'),
  },
})
