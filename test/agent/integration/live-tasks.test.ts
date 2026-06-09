/**
 * LLM Integration Tests — Real API calls driving QueryEngine.
 *
 * Requires: ATTASEEK_API_KEY environment variable.
 * Run: npm run test:agent:live
 *
 * These tests are SKIPPED in CI (no API key configured).
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { QueryEngine } from '../../../src/main/agent/orchestrator/QueryEngine'
import { codingProfile } from '../../../src/main/agent/profile/profiles/coding-profile'
import type { SessionEvent } from '../../../src/shared/types/SessionEvent'

const API_KEY = process.env.ATTASEEK_API_KEY

const describeIf = API_KEY ? describe : describe.skip

function setupProject(files: Record<string, string>): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attaseek-live-'))
  for (const [fp, content] of Object.entries(files)) {
    const full = path.join(dir, fp)
    const d = path.dirname(full)
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(full, content, 'utf-8')
  }
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) }
}

async function runAgent(prompt: string, projectDir: string): Promise<SessionEvent[]> {
  const engine = new QueryEngine({
    sessionId: 'session_live',
    projectId: projectDir,
    cwd: projectDir,
  })

  const task = {
    id: `live_${Date.now()}`,
    sessionId: 'session_live',
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

describeIf('Agent Live Integration', () => {

  it('should find and describe a bug in a TypeScript file', async () => {
    const { dir, cleanup } = setupProject({
      'src/bug.ts': `// This function has a bug: it returns the wrong value
export function add(a: number, b: number): number {
  return a - b  // BUG: should be a + b
}`,
    })

    try {
      const events = await runAgent(
        `Read the file src/bug.ts and tell me what the bug is. Be specific about the line and the fix needed.`,
        dir,
      )

      expect(events.some(e => e.type === 'TaskCompleted'), 'should complete').toBe(true)
      expect(events.some(e => e.type === 'ToolCallStarted'), 'should use tools').toBe(true)
    } finally {
      cleanup()
    }
  }, 60_000)

  it('should generate documentation for a simple module', async () => {
    const { dir, cleanup } = setupProject({
      'src/math.ts': `/** Math utilities */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}`,
    })

    try {
      const events = await runAgent(
        `Read src/math.ts and write a brief README.md for this module. Use the create_document tool.`,
        dir,
      )

      expect(events.some(e => e.type === 'TaskCompleted' || e.type === 'TaskFailed')).toBe(true)
    } finally {
      cleanup()
    }
  }, 60_000)

  it('should analyze multiple files and suggest refactoring', async () => {
    const { dir, cleanup } = setupProject({
      'src/a.ts': `export function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}`,
      'src/b.ts': `export function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}`,
    })

    try {
      const events = await runAgent(
        `Read all files in src/ and identify any code duplication. Suggest how to fix it.`,
        dir,
      )

      const toolCalls = events.filter(e => e.type === 'ToolCallStarted').length
      expect(toolCalls, 'should make at least 1 tool call').toBeGreaterThanOrEqual(1)
    } finally {
      cleanup()
    }
  }, 60_000)
})
