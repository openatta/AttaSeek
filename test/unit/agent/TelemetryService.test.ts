/**
 * Tests for TelemetryService.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  TelemetryService,
  resetMainTelemetry,
  getMainTelemetry,
  setTelemetryStore,
} from '../../../src/main/agent/telemetry/TelemetryService'
import type { TelemetryEventType } from '../../../src/main/agent/telemetry/TelemetryService'
import { JSONLStore } from '../../../src/main/store/FileStore'

// Use a temp-file JSONL store so tests don't need Electron's app module
const testStore = new JSONLStore('/tmp/atta-telemetry-test.jsonl')

describe('TelemetryService', () => {
  beforeEach(() => {
    resetMainTelemetry()
    setTelemetryStore(testStore)
  })

  afterEach(() => {
    resetMainTelemetry()
    setTelemetryStore(null)
  })

  it('creates a service with session and task IDs', () => {
    const t = new TelemetryService('sess-1', 'task-1')
    expect(t.getChainId()).toBeTruthy()
    expect(t.getChainId().length).toBe(12)
    expect(t.getDepth()).toBe(0)
  })

  it('emits events without throwing (fire-and-forget)', () => {
    const t = new TelemetryService('sess-1', 'task-1')
    // Should not throw — emit is fire-and-forget
    expect(() => {
      t.emit('agent_query_started', { testKey: 'value' })
    }).not.toThrow()
  })

  it('emits all event types without error', () => {
    const t = new TelemetryService('sess-1', 'task-1')
    const types: TelemetryEventType[] = [
      'agent_query_started',
      'agent_query_completed',
      'agent_query_error',
      'agent_auto_compact_succeeded',
      'agent_reactive_compact_succeeded',
      'agent_snip_compact_applied',
      'agent_microcompact_applied',
      'agent_context_collapse_applied',
      'agent_streaming_tool_used',
      'agent_streaming_tool_not_used',
      'agent_streaming_fallback',
      'agent_token_budget_completed',
      'agent_token_budget_continuation',
      'agent_max_output_recovery',
      'agent_fallback_model_triggered',
      'agent_structured_output_retry',
      'agent_command_processed',
    ]
    for (const type of types) {
      expect(() => t.emit(type, {})).not.toThrow()
    }
  })

  it('tracks depth for sub-agent nesting', () => {
    const t = new TelemetryService('sess-1', 'task-1', 0)
    expect(t.getDepth()).toBe(0)
    t.incrementDepth()
    expect(t.getDepth()).toBe(1)
    t.incrementDepth()
    expect(t.getDepth()).toBe(2)
  })

  it('getMainTelemetry returns same instance', () => {
    const t1 = getMainTelemetry('sess-1', 'task-1')
    const t2 = getMainTelemetry('sess-2', 'task-2')
    expect(t1).toBe(t2) // same singleton
    expect(t1.getChainId()).toBe(t2.getChainId())
  })

  it('resetMainTelemetry clears singleton', () => {
    const t1 = getMainTelemetry('sess-1', 'task-1')
    const chain1 = t1.getChainId()
    resetMainTelemetry()
    const t2 = getMainTelemetry('sess-2', 'task-2')
    expect(t2.getChainId()).not.toBe(chain1)
  })
})
