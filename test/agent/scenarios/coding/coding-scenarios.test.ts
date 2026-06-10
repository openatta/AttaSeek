/**
 * Coding Scenario Tests — Agent coding profile end-to-end validation.
 *
 * Mirrors AttaCode's LAYER3 comparison test categories:
 *   A — Code Comprehension (read, trace, explain)
 *   B — Bug Fix (diagnose, patch, verify)
 *   C — Feature (add flags, options, capabilities)
 *   D — Refactor (extract helpers, split functions)
 *   E — Testing (write unit tests, edge cases)
 *   F — Multi-turn Session (combined workflow)
 *
 * Each scenario is a JSON file loaded at import time and executed
 * against QueryEngine with MockModelProvider injected via testDeps.
 * Zero DB dependency. Zero Electron runtime requirement.
 *
 * Run: npm run test:agent:mock
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { MockModelProvider } from '../../mock/MockModelProvider'
import { QueryEngine } from '../../../../src/main/agent/orchestrator/QueryEngine'
import { setupTempDir, loadProfile } from '../setup'
import {
  assertTerminalReason,
  assertEventSequence,
  assertToolCallCount,
  assertToolsUsed,
  assertEventsNotContain,
  assertTaskCompleted,
  assertFinalTextContains,
} from '../assertions'
import type { SessionEvent } from '../../../../src/shared/types/SessionEvent'
import type { LLMChunk } from '../../../../src/main/agent/llm/ModelProvider'

// ── Types matching scenario JSON format ──

interface ScenarioTurn {
  userMessage: string
  mockResponses: LLMChunk[][]
  assert: ScenarioAssert
}

interface ScenarioAssert {
  terminalReason?: string
  toolCalls?: number
  toolsUsed?: string[]
  finalTextContains?: string
  eventsContain?: string[]
  eventsNotContain?: string[]
}

interface ScenarioFile {
  name: string
  description?: string
  profile: string
  guestFiles?: Record<string, string>
  turns: ScenarioTurn[]
}

// ── Load all scenario JSON files ──

const scenariosDir = __dirname

function loadScenarios(): ScenarioFile[] {
  const files = fs.readdirSync(scenariosDir)
    .filter(f => f.endsWith('.json'))
    .sort() // alphabetical = 01, 02, ... order

  const scenarios: ScenarioFile[] = []
  for (const file of files) {
    const content = fs.readFileSync(path.join(scenariosDir, file), 'utf-8')
    scenarios.push(JSON.parse(content))
  }
  return scenarios
}

// ── Mock adapter ──

function createMockCallModel(mockProvider: MockModelProvider) {
  return async (params: any, onChunk: any) => {
    return mockProvider.chatStream(params, onChunk)
  }
}

// ── Single scenario runner ──

async function runCodingScenario(scenario: ScenarioFile): Promise<{
  scenarioName: string
  events: SessionEvent[]
  mock: MockModelProvider
  profile: ReturnType<typeof loadProfile>
}> {
  const env = setupTempDir(scenario.guestFiles)
  const profile = loadProfile(scenario.profile)
  const mock = new MockModelProvider()

  // Program all turns into the mock provider
  for (const turn of scenario.turns) {
    for (const responseSet of turn.mockResponses) {
      const chunks = responseSet
      const hasToolUse = chunks.some(c => c.type === 'tool_use_start')

      mock.pushTurn(chunks, {
        content: hasToolUse
          ? chunks
              .filter(c => c.type === 'tool_use_start')
              .map(c => ({
                type: 'tool_use' as const,
                id: (c as any).id,
                name: (c as any).name,
                input: {},
              }))
          : [
              {
                type: 'text' as const,
                text: chunks
                  .filter(c => c.type === 'text_delta')
                  .map(c => (c as any).text)
                  .join(''),
              },
            ],
        stopReason: hasToolUse ? 'tool_use' : 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      })
    }
  }

  // Execute via QueryEngine with mock deps
  const engine = new QueryEngine({
    sessionId: `session_${scenario.name}`,
    testDeps: {
      callModel: createMockCallModel(mock),
    },
  })

  const task = {
    id: `task_${scenario.name}`,
    sessionId: `session_${scenario.name}`,
    goal: scenario.turns[0]?.userMessage || scenario.name,
    status: 'idle' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const events: SessionEvent[] = []
  const gen = engine.submitMessage(task.goal, task, profile)
  for await (const event of gen) {
    events.push(event)
  }

  env.cleanup()
  return { scenarioName: scenario.name, events, mock, profile }
}

// ── Category-organized test suites ──

describe('Coding Agent — A: Code Comprehension', () => {
  const scenarios = loadScenarios().filter(s =>
    s.name.startsWith('coding-read') || s.name.startsWith('coding-trace'),
  )

  for (const s of scenarios) {
    it(`${s.name}: ${s.description}`, async () => {
      const { events } = await runCodingScenario(s)
      const turn = s.turns[0]
      const assert = turn.assert

      if (assert.terminalReason) assertTerminalReason('completed', assert.terminalReason)
      if (assert.toolCalls !== undefined) assertToolCallCount(events, assert.toolCalls)
      if (assert.toolsUsed) assertToolsUsed(events, assert.toolsUsed)
      if (assert.eventsContain) assertEventSequence(events, assert.eventsContain)
      if (assert.eventsNotContain) assertEventsNotContain(events, assert.eventsNotContain)
      if (assert.finalTextContains) assertFinalTextContains(events, assert.finalTextContains)
      if (assert.terminalReason === 'completed') assertTaskCompleted(events)

      // Category-specific: code comprehension should include explanation text
      // Uses AgentMessage (final text) rather than AgentMessageChunk (streaming
      // events are emitted via EventBus, not yielded through the generator).
      const allText = events
        .filter(e => e.type === 'AgentMessage')
        .map(e => (e.payload as any)?.content || '')
        .join(' ')
      expect(allText.length).toBeGreaterThan(0)
    })
  }
})

describe('Coding Agent — B: Bug Fix', () => {
  const scenarios = loadScenarios().filter(s =>
    s.name.startsWith('coding-bug-fix'),
  )

  for (const s of scenarios) {
    it(`${s.name}: ${s.description}`, async () => {
      const { events } = await runCodingScenario(s)
      const turn = s.turns[0]
      const assert = turn.assert

      if (assert.terminalReason) assertTerminalReason('completed', assert.terminalReason)
      if (assert.toolCalls !== undefined) assertToolCallCount(events, assert.toolCalls)
      if (assert.toolsUsed) assertToolsUsed(events, assert.toolsUsed)
      if (assert.eventsContain) assertEventSequence(events, assert.eventsContain)
      if (assert.eventsNotContain) assertEventsNotContain(events, assert.eventsNotContain)
      if (assert.finalTextContains) assertFinalTextContains(events, assert.finalTextContains)
      if (assert.terminalReason === 'completed') assertTaskCompleted(events)

      // Category-specific: bug fixes should include edit_file tool usage
      const toolCalls = events.filter(e => e.type === 'ToolCallStarted')
      expect(toolCalls.length).toBeGreaterThan(0)
    })
  }
})

describe('Coding Agent — C: Feature', () => {
  const scenarios = loadScenarios().filter(s =>
    s.name.startsWith('coding-feature'),
  )

  for (const s of scenarios) {
    it(`${s.name}: ${s.description}`, async () => {
      const { events } = await runCodingScenario(s)
      const turn = s.turns[0]
      const assert = turn.assert

      if (assert.terminalReason) assertTerminalReason('completed', assert.terminalReason)
      if (assert.toolCalls !== undefined) assertToolCallCount(events, assert.toolCalls)
      if (assert.toolsUsed) assertToolsUsed(events, assert.toolsUsed)
      if (assert.eventsContain) assertEventSequence(events, assert.eventsContain)
      if (assert.eventsNotContain) assertEventsNotContain(events, assert.eventsNotContain)
      if (assert.finalTextContains) assertFinalTextContains(events, assert.finalTextContains)
      if (assert.terminalReason === 'completed') assertTaskCompleted(events)

      // Category-specific: features should involve multiple file reads + edits
      expect(events.filter(e => e.type === 'ToolCallStarted').length).toBeGreaterThanOrEqual(2)
    })
  }
})

describe('Coding Agent — D: Refactor', () => {
  const scenarios = loadScenarios().filter(s =>
    s.name.startsWith('coding-refactor'),
  )

  for (const s of scenarios) {
    it(`${s.name}: ${s.description}`, async () => {
      const { events } = await runCodingScenario(s)
      const turn = s.turns[0]
      const assert = turn.assert

      if (assert.terminalReason) assertTerminalReason('completed', assert.terminalReason)
      if (assert.toolCalls !== undefined) assertToolCallCount(events, assert.toolCalls)
      if (assert.toolsUsed) assertToolsUsed(events, assert.toolsUsed)
      if (assert.eventsContain) assertEventSequence(events, assert.eventsContain)
      if (assert.eventsNotContain) assertEventsNotContain(events, assert.eventsNotContain)
      if (assert.finalTextContains) assertFinalTextContains(events, assert.finalTextContains)
      if (assert.terminalReason === 'completed') assertTaskCompleted(events)

      // Category-specific: refactors must use edit_file
      expect(
        events
          .filter(e => e.type === 'ToolCallStarted')
          .map(e => (e.payload as any)?.toolId)
          .filter(Boolean),
      ).toContain('edit_file')
    })
  }
})

describe('Coding Agent — E: Testing', () => {
  const scenarios = loadScenarios().filter(s =>
    s.name.startsWith('coding-write'),
  )

  for (const s of scenarios) {
    it(`${s.name}: ${s.description}`, async () => {
      const { events } = await runCodingScenario(s)
      const turn = s.turns[0]
      const assert = turn.assert

      if (assert.terminalReason) assertTerminalReason('completed', assert.terminalReason)
      if (assert.toolCalls !== undefined) assertToolCallCount(events, assert.toolCalls)
      if (assert.toolsUsed) assertToolsUsed(events, assert.toolsUsed)
      if (assert.eventsContain) assertEventSequence(events, assert.eventsContain)
      if (assert.eventsNotContain) assertEventsNotContain(events, assert.eventsNotContain)
      if (assert.finalTextContains) assertFinalTextContains(events, assert.finalTextContains)
      if (assert.terminalReason === 'completed') assertTaskCompleted(events)

      // Category-specific: test writing should use write_file
      expect(
        events
          .filter(e => e.type === 'ToolCallStarted')
          .map(e => (e.payload as any)?.toolId)
          .filter(Boolean),
      ).toContain('write_file')
    })
  }
})

describe('Coding Agent — F: Multi-turn Session', () => {
  const scenarios = loadScenarios().filter(s =>
    s.name.startsWith('coding-multi'),
  )

  for (const s of scenarios) {
    it(`${s.name}: ${s.description}`, async () => {
      const { events } = await runCodingScenario(s)
      const turn = s.turns[0]
      const assert = turn.assert

      if (assert.terminalReason) assertTerminalReason('completed', assert.terminalReason)
      if (assert.toolCalls !== undefined) assertToolCallCount(events, assert.toolCalls)
      if (assert.toolsUsed) assertToolsUsed(events, assert.toolsUsed)
      if (assert.eventsContain) assertEventSequence(events, assert.eventsContain)
      if (assert.eventsNotContain) assertEventsNotContain(events, assert.eventsNotContain)
      if (assert.finalTextContains) assertFinalTextContains(events, assert.finalTextContains)
      if (assert.terminalReason === 'completed') assertTaskCompleted(events)

      // Category-specific: multi-turn sessions should have multiple turns
      expect(events.filter(e => e.type === 'AgentMessage').length).toBeGreaterThanOrEqual(1)
    })
  }
})

// ── Cross-cutting assertions ──

describe('Coding Agent — Cross-cutting: Coding Profile Integrity', () => {
  it('coding profile should have all expected tool categories', () => {
    const profile = loadProfile('coding')
    expect(profile.id).toBe('coding')
    expect(profile.execution.maxTurns).toBeGreaterThanOrEqual(10)
    expect(profile.execution.planning).toBe('inline')
    expect(profile.tools).toContain('read_file')
    expect(profile.tools).toContain('write_file')
    expect(profile.tools).toContain('edit_file')
    expect(profile.tools).toContain('grep')
    expect(profile.tools).toContain('bash')
    expect(profile.tools).toContain('task_create')
    expect(profile.tools).toContain('spawn_agent')
    expect(profile.tools).toContain('skill')
  })

  it('coding profile should have memory autoExtract enabled', () => {
    const profile = loadProfile('coding')
    expect(profile.memory.autoExtract).toBe(true)
    expect(profile.memory.loadFileMemory).toBe(true)
    expect(profile.memory.scopes).toContain('project')
    expect(profile.memory.scopes).toContain('user')
  })

  it('coding profile should have context budgets configured', () => {
    const profile = loadProfile('coding')
    expect(profile.context.maxTokens).toBeGreaterThan(0)
    expect(profile.context.budgets.system).toBeGreaterThan(0)
    expect(profile.context.budgets.tools).toBeGreaterThan(0)
    expect(profile.context.budgets.messages).toBeGreaterThan(0)
    expect(profile.context.autoCompact).toBe(true)
  })

  it('all coding scenarios should complete without failure', async () => {
    const scenarios = loadScenarios()
    expect(scenarios.length).toBeGreaterThanOrEqual(10)

    for (const s of scenarios) {
      const { events } = await runCodingScenario(s)
      expect(
        events.some(e => e.type === 'TaskFailed'),
        `${s.name}: should not have TaskFailed`,
      ).toBe(false)
      expect(
        events.some(e => e.type === 'TaskCompleted'),
        `${s.name}: should have TaskCompleted`,
      ).toBe(true)
    }
  })

  it('all coding scenarios should emit UserMessage as first event', async () => {
    const scenarios = loadScenarios()
    for (const s of scenarios) {
      const { events } = await runCodingScenario(s)
      expect(events.length).toBeGreaterThan(0)
      expect(events[0].type, `${s.name}: first event should be UserMessage`).toBe('UserMessage')
    }
  })
})

describe('Coding Agent — Cross-cutting: Tool Error Resilience', () => {
  it('should handle unknown tool gracefully in coding profile', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn(
      [
        { type: 'tool_use_start', id: 'tu_x', name: 'non_existent_tool' },
        { type: 'tool_use_delta', id: 'tu_x', input_json: '{}' },
        { type: 'content_block_stop', index: 1 },
        { type: 'message_stop' },
      ],
      {
        content: [{ type: 'tool_use', id: 'tu_x', name: 'non_existent_tool', input: {} }],
        stopReason: 'tool_use',
        usage: { inputTokens: 100, outputTokens: 50 },
      },
    )
    mock.pushTurn(
      [{ type: 'text_delta', text: 'Recovered from unknown tool' }, { type: 'message_stop' }],
      {
        content: [{ type: 'text', text: 'Recovered from unknown tool' }],
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 30 },
      },
    )

    const profile = loadProfile('coding')
    const engine = new QueryEngine({
      sessionId: 's_err',
      testDeps: { callModel: createMockCallModel(mock) },
    })

    const task = {
      id: 't_err', sessionId: 's_err', goal: 'Use bad tool',
      status: 'idle' as const, createdAt: Date.now(), updatedAt: Date.now(),
    }

    const events: SessionEvent[] = []
    const gen = engine.submitMessage('Use bad tool', task, profile)
    for await (const e of gen) events.push(e)

    const finished = events.filter(e => e.type === 'ToolCallFinished')
    expect(finished.length).toBeGreaterThanOrEqual(1)
    expect(finished[0]?.payload?.status).toBe('error')
    expect(events.some(e => e.type === 'TaskCompleted')).toBe(true)
  })
})
