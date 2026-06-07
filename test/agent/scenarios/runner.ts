/**
 * Scenario runner — loads JSON scenario files and executes them
 * against AgentOrchestrator with MockModelProvider.
 */

import { describe, it } from 'vitest'
import { MockModelProvider } from '../mock/MockModelProvider'
import { AgentOrchestrator } from '../../../src/main/agent/orchestrator/AgentOrchestrator'
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

/** Run a single scenario */
export async function runScenario(scenario: ScenarioFile): Promise<void> {
  const env = setupTempDir(scenario.guestFiles)
  try {
    const profile = loadProfile(scenario.profile)
    const mockProvider = new MockModelProvider()
    const orchestrator = new AgentOrchestrator()

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
      // Determine result from chunks: if last chunk is a tool_use, return tool_use result
      const lastChunk = chunks[chunks.length - 1]
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

    // Execute
    const events: SessionEvent[] = []
    const gen = orchestrator.submitMessage(task, profile, mockProvider)
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
