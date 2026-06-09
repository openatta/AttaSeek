import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryEngine } from '../../../src/main/agent/orchestrator/QueryEngine'
import { validateProfile } from '../../../src/main/agent/profile/AgentProfile'

// Minimal valid profile for testing
const testProfile = validateProfile({
  id: 'test',
  name: 'Test Agent',
  systemPrompt: {
    id: 'test',
    sections: [{ name: 'identity', priority: 10, content: 'You are a test agent.' }],
  },
})

const testTask = {
  id: 'task_test',
  sessionId: 'session_test',
  goal: 'test goal',
  status: 'idle' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

describe('QueryEngine', () => {
  let engine: QueryEngine

  beforeEach(() => {
    engine = new QueryEngine({ sessionId: 'session_test' })
  })

  it('should return no_provider if no LLM provider is configured', async () => {
    const gen = engine.submitMessage(
      'test goal',
      { ...testTask },
      { ...testProfile, execution: { ...testProfile.execution, maxTurns: 1 } },
    )

    const events: unknown[] = []
    for await (const event of gen) {
      events.push(event)
    }

    expect(events.length).toBeGreaterThan(0)
    // QueryEngine emits UserMessage first, then TaskFailed when provider is missing
    const failed = events.find(e => e.type === 'TaskFailed')
    expect(failed).toBeDefined()
    expect(failed).toMatchObject({
      payload: expect.objectContaining({ recoverable: false }),
    })
  })

  it('should create per-instance AbortController', () => {
    engine.interrupt()
    // After interrupt, a new submitMessage should get a fresh controller
    const gen = engine.submitMessage('test goal', { ...testTask }, testProfile)
    expect(gen).toBeDefined()
    // Clean up
    gen.return()
  })

  it('should validate profile with default values', () => {
    const profile = validateProfile({
      id: 'minimal',
      name: 'Minimal',
      systemPrompt: { id: 'min', sections: [] },
    })

    expect(profile.execution.maxTurns).toBe(10)
    expect(profile.execution.maxParallelTools).toBe(16)
    expect(profile.context.autoCompact).toBe(true)
    expect(profile.output.generateArtifact).toBe(true)
  })

  it('should handle profile without defaults — uses validateProfile fallbacks', () => {
    const profile = validateProfile({
      id: 'no-opts',
      name: 'No Options',
      systemPrompt: { id: 'nop', sections: [] },
      execution: {},
    } as any)

    expect(profile.execution.maxTurns).toBe(10)
    expect(profile.execution.maxParallelTools).toBe(16)
  })
})
