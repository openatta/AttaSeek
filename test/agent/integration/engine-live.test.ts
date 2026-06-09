/**
 * QueryEngine Live Integration Tests
 *
 * Uses the real LLM provider configured in ~/.atta/settings.json to
 * verify the full execution pipeline: context assembly → LLM call →
 * tool execution → finalize. No mocking — these are end-to-end tests.
 *
 * Tool-calling is model-dependent. These tests use soft assertions:
 *   - Hard: pipeline completes (TaskCompleted), agent produces responses
 *   - Soft: if tools ARE used, verify correct tool names and counts
 * This ensures the engine works across all providers (Claude, DeepSeek, etc.).
 *
 * Requires: A provider configured at ~/.atta/settings.json with a valid auth_token.
 * The tests auto-skip if no provider is available.
 *
 * Run: npx vitest run test/agent/integration/engine-live.test.ts
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { QueryEngine } from '../../../src/main/agent/orchestrator/QueryEngine'
import { codingProfile } from '../../../src/main/agent/profile/profiles/coding-profile'
import { modelConfigService } from '../../../src/main/model/ModelConfigService'
import { invalidateConfigCache } from '../../../src/main/agent/llm/AttaSettingsLoader'
import { toolRegistry } from '../../../src/main/tools/ToolRegistry'
import { toolRouter } from '../../../src/main/tools/ToolRouter'
import { FILE_OPS_TOOLS } from '../../../src/main/agent/tools/implementations/file-ops-tools'
import { BASH_TOOLS } from '../../../src/main/agent/tools/implementations/bash-tools'
import { WRITING_TOOLS } from '../../../src/main/agent/tools/implementations/writing-tools'
import { DEMO_TOOLS } from '../../../src/main/agent/tools/implementations/demo-tools'
import { TODO_TOOLS } from '../../../src/main/agent/tools/implementations/todo-tools'
import type { SessionEvent } from '../../../src/shared/types/SessionEvent'

// ── Setup (module-level — loadAll() is synchronous) ──

invalidateConfigCache()
modelConfigService.loadAll()
const hasProvider = modelConfigService.hasConfigured()

if (hasProvider) {
  toolRegistry.registerAll([
    ...DEMO_TOOLS,
    ...FILE_OPS_TOOLS,
    ...BASH_TOOLS,
    ...WRITING_TOOLS,
    ...TODO_TOOLS,
  ])
  toolRouter.setTopK(100)
}

const describeIf = hasProvider ? describe : describe.skip

// ── Helpers ──

function setupProject(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attaseek-live-'))
  for (const [fp, content] of Object.entries(files)) {
    const full = path.join(dir, fp)
    const d = path.dirname(full)
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(full, content, 'utf-8')
  }
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) }
}

async function runAgent(prompt: string, projectDir?: string): Promise<SessionEvent[]> {
  const engine = new QueryEngine({
    sessionId: `live_${Date.now()}`,
    projectId: projectDir,
    cwd: projectDir,
  })

  const task = {
    id: `live_${Date.now()}`,
    sessionId: `session_live`,
    goal: prompt,
    status: 'idle' as const,
    projectId: projectDir,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const events: SessionEvent[] = []
  for await (const event of engine.submitMessage(prompt, task, codingProfile)) {
    events.push(event)
  }
  return events
}

function eventsOfType(events: SessionEvent[], type: string) {
  return events.filter(e => e.type === type)
}

function toolCallNames(events: SessionEvent[]): string[] {
  return eventsOfType(events, 'ToolCallStarted').map((e: any) => e.payload?.toolName)
}

function hasToolCalls(events: SessionEvent[]): boolean {
  return eventsOfType(events, 'ToolCallStarted').length > 0
}

// ── Tests ──

describeIf('QueryEngine Live — File I/O', () => {

  it('T1: investigates a cross-file bug (complex read-only task)', async () => {
    const { dir, cleanup } = setupProject({
      'src/constants.ts': `export const DEFAULT_RATE = 0.05
export const MAX_RETRIES = 3`,
      'src/calculator.ts': `import { DEFAULT_RATE } from './constants'
export function calculateInterest(p: number, y: number) { return p * 0.08 * y }`,
      'src/index.ts': `export { calculateInterest } from './calculator'`,
    })

    try {
      const events = await runAgent(
        `Investigate the bug: src/calculator.ts imports DEFAULT_RATE from src/constants.ts ` +
        `but hardcodes 0.08 instead. Read both files, identify the bug line, and explain the fix.`,
        dir,
      )

      // Hard: pipeline completes
      expect(events.some(e => e.type === 'TaskCompleted'), 'completes').toBe(true)
      expect(eventsOfType(events, 'AgentMessage').length, 'produces responses').toBeGreaterThanOrEqual(1)

      // Soft: if tools are used, they must be correct
      if (hasToolCalls(events)) {
        const names = toolCallNames(events)
        expect(names.filter(n => n === 'read_file').length, 'reads files').toBeGreaterThanOrEqual(2)
      }
    } finally {
      cleanup()
    }
  }, 60_000)

  it('T2: audits a multi-module utility library', async () => {
    const { dir, cleanup } = setupProject({
      'src/utils/math.ts': `export function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi) }`,
      'src/utils/strings.ts': `export function titleCase(s: string) { return s[0].toUpperCase() + s.slice(1).toLowerCase() }`,
      'src/utils/dates.ts': `export function formatISO(d: Date) { return d.toISOString().split('T')[0] }`,
      'src/utils/async.ts': `export async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }`,
      'src/core/config.ts': `export const config = { apiUrl: 'https://api.example.com', timeout: 5000 }`,
    })

    try {
      const events = await runAgent(
        `Audit the src/utils/ directory. Find all TypeScript files, read each one, ` +
        `and produce a report listing every exported function with its signature and a ` +
        `one-line description.`,
        dir,
      )

      expect(events.some(e => e.type === 'TaskCompleted'), 'completes').toBe(true)

      if (hasToolCalls(events)) {
        const names = toolCallNames(events)
        const count = names.filter(n => n === 'read_file').length
        expect(count + (names.includes('grep') ? 1 : 0), 'reads or searches multiple files')
          .toBeGreaterThanOrEqual(2)
      }
    } finally {
      cleanup()
    }
  }, 60_000)
})

describeIf('QueryEngine Live — Code Generation & Editing', () => {

  it('T3: reads conventions then creates a matching module', async () => {
    const { dir, cleanup } = setupProject({
      'src/format/currency.ts': `/** Format as currency. @param amount @param locale @returns string */
export function formatCurrency(amount: number, locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(amount)
}`,
    })

    try {
      const events = await runAgent(
        `Read src/format/currency.ts to understand the coding conventions (JSDoc style, ` +
        `export pattern, signatures). Then create a new file src/format/date.ts with a ` +
        `formatDate function following the same conventions. After writing, read the new ` +
        `file to verify it matches.`,
        dir,
      )

      expect(events.some(e => e.type === 'TaskCompleted'), 'completes').toBe(true)

      // Verify file creation if tools were used
      if (hasToolCalls(events)) {
        const names = toolCallNames(events)
        if (names.includes('write_file')) {
          const filePath = path.join(dir, 'src', 'format', 'date.ts')
          expect(fs.existsSync(filePath), 'date.ts created').toBe(true)
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8')
            expect(content.toLowerCase()).toContain('formatdate')
          }
        }
      }
    } finally {
      cleanup()
    }
  }, 60_000)

  it('T4: reads, edits, and verifies a markdown document', async () => {
    const { dir, cleanup } = setupProject({
      'CHANGELOG.md': `# Changelog\n## v1.2.0 (2026-05-01)\n- Added dark mode\n## v1.1.0 (2026-04-15)\n- Initial release`,
    })

    try {
      const events = await runAgent(
        `Read CHANGELOG.md, then correct the v1.1.0 date from "2026-04-15" to "2026-03-20" ` +
        `using edit_file. After editing, read the file again to verify the date was corrected.`,
        dir,
      )

      expect(events.some(e => e.type === 'TaskCompleted'), 'completes').toBe(true)

      // Verify edit if tools were used
      if (hasToolCalls(events)) {
        const names = toolCallNames(events)
        if (names.includes('edit_file')) {
          const content = fs.readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf-8')
          expect(content).toContain('2026-03-20')
        }
      }
    } finally {
      cleanup()
    }
  }, 60_000)
})

describeIf('QueryEngine Live — Multi-Turn & Search', () => {

  it('T5: performs a two-step investigation with conversation continuity', async () => {
    const { dir, cleanup } = setupProject({
      'package.json': JSON.stringify({
        name: 'test-pkg', version: '1.0.0',
        scripts: { build: 'tsc', test: 'vitest run', lint: 'eslint src/' },
      }, null, 2),
    })

    try {
      const engine = new QueryEngine({ sessionId: `multi_${Date.now()}`, projectId: dir, cwd: dir })
      const task = { id: `mt_${Date.now()}`, sessionId: engine.getConfig().sessionId, goal: 'audit', status: 'idle' as const, createdAt: Date.now(), updatedAt: Date.now() }

      // Turn 1
      const e1: SessionEvent[] = []
      for await (const e of engine.submitMessage(
        `Read package.json and tell me what npm scripts are defined.`,
        task, codingProfile,
      )) { e1.push(e) }
      expect(e1.some(e => e.type === 'TaskCompleted'), 'turn 1 completes').toBe(true)
      expect(e1.length, 'turn 1 has events').toBeGreaterThan(0)

      // Turn 2 — context persists
      const e2: SessionEvent[] = []
      for await (const e of engine.submitMessage(
        `Based on the package.json from the previous turn, which command runs tests?`,
        { ...task, goal: 'followup' }, codingProfile,
      )) { e2.push(e) }
      expect(e2.some(e => e.type === 'TaskCompleted'), 'turn 2 completes').toBe(true)
      expect(e2.length, 'turn 2 has events').toBeGreaterThan(0)
    } finally {
      cleanup()
    }
  }, 60_000)

  it('T6: searches codebase for issues then reads and prioritizes', async () => {
    const { dir, cleanup } = setupProject({
      'src/auth/login.ts': `// TODO: OAuth2 // TODO: rate limiting
export function login(u: string, p: string) { return true }`,
      'src/auth/signup.ts': `// FIXME: validate email
export function signup(e: string, p: string) { return { id: '1', email: e } }`,
      'src/api/routes.ts': `// TODO: pagination // HACK: hardcoded limit
export function listUsers() { return [] }`,
    })

    try {
      const events = await runAgent(
        `Search all TypeScript files in src/ for TODO, FIXME, and HACK comments. ` +
        `Read each file that has matches and produce a prioritized report grouped by ` +
        `severity: security fixes first (FIXME), then functional gaps (TODO), then tech debt (HACK).`,
        dir,
      )

      expect(events.some(e => e.type === 'TaskCompleted'), 'completes').toBe(true)
      expect(eventsOfType(events, 'AgentMessage').length, 'produces response').toBeGreaterThanOrEqual(1)

      if (hasToolCalls(events)) {
        const names = toolCallNames(events)
        expect(names.length, 'uses tools for search + read').toBeGreaterThanOrEqual(2)
      }
    } finally {
      cleanup()
    }
  }, 60_000)
})

describeIf('QueryEngine Live — Edge Cases', () => {

  it('T7: plain-text Q&A without tools or project', async () => {
    const events = await runAgent('What is 2 + 2? Just answer with the number.')

    expect(events.some(e => e.type === 'TaskCompleted'), 'completes').toBe(true)
    expect(eventsOfType(events, 'AgentMessage').length, 'has agent messages').toBeGreaterThanOrEqual(1)
  }, 30_000)
})
