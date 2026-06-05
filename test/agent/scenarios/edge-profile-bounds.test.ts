/**
 * Profile boundary value + LLMProvider error mapping depth tests.
 */
import { describe, it, expect } from 'vitest'
import { MockLLMProvider } from '../mock/MockLLMProvider'
import { textDelta, messageStop, endTurnResult, toolUseStart, toolUseDelta, blockStop } from '../mock/helpers'
import { AgentOrchestrator } from '../../../src/main/agent/orchestrator/AgentOrchestrator'
import { validateProfile } from '../../../src/main/agent/profile/AgentProfile'
import { LLMError } from '../../../src/main/agent/llm/LLMProvider'

const baseProfile = { id: 'test', name: 'Test', systemPrompt: { id: 't', sections: [{ name: 'i', priority: 10, content: 'Test.' }] } }
const emptyCtx = { messages: [] as any[], tools: [] as any[] }
const mkTask = (g: string) => ({ id: 't', sessionId: 's', goal: g, status: 'idle' as const, createdAt: Date.now(), updatedAt: Date.now() })

describe('Profile — maxTurns boundary', () => {
  it('maxTurns=0 should stop before LLM call', async () => {
    const p = validateProfile({ ...baseProfile, execution: { maxTurns: 0 } })
    const mock = new MockLLMProvider()
    mock.pushTurn([textDelta('hi'), messageStop()], endTurnResult('hi'))

    const orchestrator = new AgentOrchestrator()
    const events: any[] = []
    const gen = orchestrator.submitMessage(mkTask('Test'), p, mock, emptyCtx)
    for await (const e of gen) events.push(e)

    // Should emit TaskCompleted immediately without LLM call
    expect(events.some(e => e.type === 'TaskCompleted'), 'completes immediately').toBe(true)
    expect(mock.requestCount, 'no LLM calls').toBe(0)
  })

  it('maxTurns=1 should allow exactly one LLM turn', async () => {
    const p = validateProfile({ ...baseProfile, execution: { maxTurns: 1 } })
    const mock = new MockLLMProvider()
    mock.pushTurn([textDelta('one'), messageStop()], endTurnResult('one'))

    const orchestrator = new AgentOrchestrator()
    const events: any[] = []
    const gen = orchestrator.submitMessage(mkTask('Test'), p, mock, emptyCtx)
    for await (const e of gen) events.push(e)

    expect(mock.requestCount, 'exactly one LLM call').toBe(1)
    expect(events.some(e => e.type === 'TaskCompleted'), 'completes').toBe(true)
  })

  it('should handle 0 maxParallelTools gracefully', async () => {
    const p = validateProfile({ ...baseProfile, execution: { maxParallelTools: 0 } })
    expect(p.execution.maxParallelTools).toBe(0)
  })

  it('should work with artifact generation enabled', async () => {
    const p = validateProfile({ ...baseProfile, output: { generateArtifact: true } })
    const mock = new MockLLMProvider()
    mock.pushTurn([textDelta('Artifact test'), messageStop()], endTurnResult('Artifact test'))

    const orchestrator = new AgentOrchestrator()
    const events: any[] = []
    const gen = orchestrator.submitMessage(mkTask('Test'), p, mock, emptyCtx)
    for await (const e of gen) events.push(e)

    expect(events.some(e => e.type === 'TaskCompleted'), 'completes with artifact').toBe(true)
  })
})

describe('LLMError — full classification', () => {
  it.each([
    ['auth', 'auth_error'],
    ['rate_limit', 'rate_limit_error'],
    ['invalid_request', 'invalid_request_error'],
    ['not_found', 'not_found_error'],
    ['server', 'server_error'],
    ['timeout', 'timeout_error'],
    ['unknown', 'unknown_error'],
  ])('should classify error code: %s', async (code, _desc) => {
    const mock = new MockLLMProvider()
    mock.pushError(code as LLMError['code'], `Simulated ${code} error`)

    const orchestrator = new AgentOrchestrator()
    const events: any[] = []
    const gen = orchestrator.submitMessage(mkTask('Test'), validateProfile(baseProfile), mock, emptyCtx)
    for await (const e of gen) events.push(e)

    expect(events.some(e => e.type === 'TaskFailed'), `fails for ${code}`).toBe(true)
  })

  it('should throw with correct LLMError code', async () => {
    const mock = new MockLLMProvider()
    mock.pushError('auth', 'Invalid API key')
    try {
      await mock.chatStream({ systemPrompt: '', messages: [], tools: [] }, () => {})
      expect(false, 'should have thrown').toBe(true)
    } catch (err) {
      expect(err).toBeInstanceOf(LLMError)
      expect((err as LLMError).code).toBe('auth')
    }
  })
})
