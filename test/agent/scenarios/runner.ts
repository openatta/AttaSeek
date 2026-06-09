/**
 * Scenario runner — loads JSON scenario files and executes them
 * against QueryEngine with MockModelProvider injected via testDeps.
 */

import { describe, it } from 'vitest'
import { MockModelProvider } from '../mock/MockModelProvider'
import { QueryEngine } from '../../../src/main/agent/orchestrator/QueryEngine'
import { setupTempDir, loadProfile } from './setup'
import {
  assertTerminalReason,
  assertEventSequence,
  assertToolCallCount,
  assertToolsUsed,
  assertEventsNotContain,
  assertTaskCompleted,
} from './assertions'
import type { SessionEvent } from '../../../src/shared/types/SessionEvent'
import type { LLMChunk } from '../../../src/main/agent/llm/ModelProvider'
import type { QueryDeps } from '../../../src/main/agent/orchestrator/QueryDeps'

// ── Types matching scenario JSON format ──

interface ScenarioFile {
  name: string
  description?: string
  profile: string
  guestFiles?: Record<string, string>
  turns: ScenarioTurn[]
}

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

/** Wrap MockModelProvider as a QueryDeps.callModel adapter. */
function createMockCallModel(mockProvider: MockModelProvider): QueryDeps['callModel'] {
  return async (params, onChunk) => {
    return mockProvider.chatStream(
      params as Parameters<typeof mockProvider.chatStream>[0],
      onChunk as Parameters<typeof mockProvider.chatStream>[1],
    )
  }
}

/** Run a single scenario */
export async function runScenario(scenario: ScenarioFile): Promise<void> {
  const env = setupTempDir(scenario.guestFiles)
  try {
    const profile = loadProfile(scenario.profile)
    const mockProvider = new MockModelProvider()

    // For the first turn only (single-user-message scenarios)
    const turn = scenario.turns[0]
    const task = {
      id: `task_${scenario.name}`,
      sessionId: `session_${scenario.name}`,
      goal: turn.userMessage,
      status: 'idle' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // Program mock responses
    for (const responseSet of turn.mockResponses) {
      const chunks = responseSet
      const hasToolUse = chunks.some(c => c.type === 'tool_use_start')
      mockProvider.pushTurn(chunks, {
        content: hasToolUse
          ? chunks.filter(c => c.type === 'tool_use_start').map(c => ({
              type: 'tool_use' as const,
              id: (c as any).id,
              name: (c as any).name,
              input: {},
            }))
          : [{ type: 'text' as const, text: chunks.filter(c => c.type === 'text_delta').map(c => (c as any).text).join('') }],
        stopReason: hasToolUse ? 'tool_use' : 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      })
    }

    // Execute via QueryEngine with mock deps
    const engine = new QueryEngine({
      sessionId: `session_${scenario.name}`,
      testDeps: {
        callModel: createMockCallModel(mockProvider),
      },
    })

    const events: SessionEvent[] = []
    const gen = engine.submitMessage(turn.userMessage, task, profile)
    for await (const event of gen) {
      events.push(event)
    }

    // Assert
    const assert = turn.assert
    if (assert.terminalReason) assertTerminalReason('completed', assert.terminalReason)
    if (assert.toolCalls !== undefined) assertToolCallCount(events, assert.toolCalls)
    if (assert.toolsUsed) assertToolsUsed(events, assert.toolsUsed)
    if (assert.eventsContain) assertEventSequence(events, assert.eventsContain)
    if (assert.eventsNotContain) assertEventsNotContain(events, assert.eventsNotContain)
    if (assert.terminalReason === 'completed') assertTaskCompleted(events)

  } finally {
    env.cleanup()
  }
}

/** Register scenarios as vitest tests */
export function registerScenarios(scenarios: ScenarioFile[]): void {
  for (const s of scenarios) {
    it(s.name, async () => {
      await runScenario(s)
    })
  }
}
