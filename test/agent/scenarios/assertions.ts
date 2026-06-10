/**
 * Assertion helpers for scenario tests.
 * Each function validates one aspect of the agent execution result.
 */

import { expect } from 'vitest'
import type { SessionEvent } from '../../../src/shared/types/SessionEvent'

/** Verify the terminal reason matches expected */
export function assertTerminalReason(
  reason: string | undefined,
  expected: string,
): void {
  expect(reason, `terminal reason should be "${expected}"`).toBe(expected)
}

/** Verify specific event types appear in order */
export function assertEventSequence(
  events: SessionEvent[],
  expectedTypes: string[],
): void {
  const eventTypes = events.map(e => e.type)
  for (const expected of expectedTypes) {
    expect(eventTypes, `events should contain "${expected}"`).toContain(expected)
  }
}

/** Verify total tool call count */
export function assertToolCallCount(events: SessionEvent[], expected: number): void {
  const count = events.filter(e => e.type === 'ToolCallStarted').length
  expect(count, `tool call count`).toBe(expected)
}

/** Verify specific tools were used */
export function assertToolsUsed(events: SessionEvent[], toolIds: string[]): void {
  const used = events
    .filter(e => e.type === 'ToolCallStarted')
    .map(e => (e.payload as any)?.toolId)
    .filter(Boolean)
  for (const id of toolIds) {
    expect(used, `tools used should include "${id}"`).toContain(id)
  }
}

/** Verify final text response contains substring */
export function assertFinalTextContains(events: SessionEvent[], substr: string): void {
  // Check AgentMessageChunk events first (streaming), then AgentMessage (final)
  const chunkText = events
    .filter(e => e.type === 'AgentMessageChunk')
    .map(e => (e.payload as any)?.content || '')
    .join(' ')
  const finalText = events
    .filter(e => e.type === 'AgentMessage')
    .map(e => (e.payload as any)?.content || '')
    .join(' ')
  const allText = (chunkText + ' ' + finalText).toLowerCase()
  expect(allText, `final text should contain "${substr}"`).toContain(substr.toLowerCase())
}

/** Verify certain events do NOT appear */
export function assertEventsNotContain(events: SessionEvent[], types: string[]): void {
  const eventTypes = new Set(events.map(e => e.type))
  for (const t of types) {
    expect(eventTypes.has(t), `events should NOT contain "${t}"`).toBe(false)
  }
}

/** Verify task completed successfully */
export function assertTaskCompleted(events: SessionEvent[]): void {
  expect(events.some(e => e.type === 'TaskCompleted'), 'should have TaskCompleted').toBe(true)
  expect(events.some(e => e.type === 'TaskFailed'), 'should not have TaskFailed').toBe(false)
}
