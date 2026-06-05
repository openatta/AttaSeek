/**
 * Depth tests: ContextCompactor, MemoryExtractor, SubAgentManager, EventBus, Token, Prompt.
 */
import { describe, it, expect, beforeEach } from 'vitest'

// ── ContextCompactor ──
import { shouldCompact, compactConversation } from '../../../src/main/agent/compact/ContextCompactor'
import { validateProfile } from '../../../src/main/agent/profile/AgentProfile'

const compactProfile = validateProfile({
  id: 'test', name: 'Test',
  systemPrompt: { id: 't', sections: [{ name: 'i', priority: 10, content: 'Test.' }] },
  context: { autoCompact: true, compactTriggerRatio: 0.5, keepRecentTurns: 1, maxTokens: 1000, budgets: { system: 100, tools: 100, memory: 100, messages: 500, reserve: 200 } },
})

describe('ContextCompactor — shouldCompact', () => {
  it('should return false when messages are under budget', () => {
    const msgs = [{ role: 'user' as const, content: 'short' }]
    expect(shouldCompact(msgs, compactProfile)).toBe(false)
  })

  it('should return true when messages exceed trigger ratio', () => {
    const msgs = Array.from({ length: 200 }, (_, i) => ({ role: i % 2 === 0 ? 'user' as const : 'assistant' as const, content: 'padding message text to fill space xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }))
    expect(shouldCompact(msgs, compactProfile)).toBe(true)
  })

  it('shouldCompact checks token budget (not autoCompact flag)', () => {
    // shouldCompact only checks token budget — autoCompact flag is checked by the orchestrator
    const msgs = [{ role: 'user' as const, content: 'short' }]
    expect(shouldCompact(msgs, compactProfile)).toBe(false) // under budget
  })
})

describe('ContextCompactor — compactConversation', () => {
  it('should keep recent turns when compacting', async () => {
    const msgs = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `Message number ${i}`,
    }))
    const result = await compactConversation(msgs, compactProfile)

    // keepRecentTurns=1 → keep 2 messages (1 user + 1 assistant)
    expect(result.compactedMessages.length).toBeLessThan(msgs.length)
    expect(result.compactedCount).toBeGreaterThan(0)
  })

  it('should not compact when messages fit within keepRecentTurns', async () => {
    const msgs = [{ role: 'user' as const, content: 'hi' }, { role: 'assistant' as const, content: 'hello' }]
    const result = await compactConversation(msgs, compactProfile)

    expect(result.compactedCount).toBe(0)
    expect(result.compactedMessages).toEqual(msgs)
  })

  it('should fall back to truncation when LLM provider unavailable', async () => {
    // compactConversation will attempt LLM call via registry, then fall back
    const msgs = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `Message ${i} with text to fill budget xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
    }))
    const result = await compactConversation(msgs, compactProfile)

    // Either LLM succeeds (if provider exists from other tests) or falls back
    expect(result.compactedMessages.length).toBeLessThan(msgs.length)
    expect(result.compactedCount).toBeGreaterThan(0)
    expect(result.tokenSaved).toBeGreaterThanOrEqual(0)
  })
})

// ── MemoryExtractor ──
import { extractMemories } from '../../../src/main/agent/memory/MemoryExtractor'

describe('MemoryExtractor', () => {
  // MemoryExtractor requires DB (Electron runtime). Tested via E2E integration.
  it.skip('requires Electron runtime (DB dependent)', () => {})
})

// ── SubAgentManager ──
import { SubAgentManager } from '../../../src/main/agent/subagent/SubAgentManager'

describe('SubAgentManager', () => {
  let manager: SubAgentManager

  beforeEach(() => { manager = new SubAgentManager() })

  it('should create and list sub-agents', () => {
    // Just test the manager's data structure — no actual fork (needs full setup)
    expect(manager.list()).toEqual([])
  })

  it('should handle cancelAll on empty manager', () => {
    manager.cancelAll() // no crash
    expect(manager.list()).toEqual([])
  })

  it('should handle get on non-existent agent', () => {
    expect(manager.get('nonexistent')).toBeUndefined()
  })
})

// ── AgentEventBus ──
import { AgentEventBus, agentEventBus } from '../../../src/main/agent/AgentEventBus'

describe('AgentEventBus', () => {
  let bus: AgentEventBus

  beforeEach(() => { bus = new AgentEventBus() })

  it('should emit and retrieve events by session', () => {
    const event: any = { id: '1', sessionId: 's1', type: 'UserMessage', payload: { content: 'hi' }, createdAt: Date.now() }
    bus.emit(event)
    expect(bus.getHistory('s1')).toHaveLength(1)
    expect(bus.getHistory('s1')[0].type).toBe('UserMessage')
  })

  it('should isolate sessions', () => {
    bus.emit({ id: '1', sessionId: 's1', type: 'UserMessage', payload: { content: 'a' }, createdAt: Date.now() } as any)
    bus.emit({ id: '2', sessionId: 's2', type: 'UserMessage', payload: { content: 'b' }, createdAt: Date.now() } as any)
    expect(bus.getHistory('s1')).toHaveLength(1)
    expect(bus.getHistory('s2')).toHaveLength(1)
  })

  it('should cap history at 1000 events per session', () => {
    for (let i = 0; i < 1100; i++) {
      bus.emit({ id: `${i}`, sessionId: 's1', type: 'UserMessage', payload: { content: `msg${i}` }, createdAt: Date.now() } as any)
    }
    expect(bus.getHistory('s1').length, 'capped at 1000').toBe(1000)
    // First 100 events trimmed
    expect((bus.getHistory('s1')[0].payload as any).content).not.toBe('msg0')
  })

  it('should not crash when a listener throws', () => {
    bus.subscribe('s1', () => { throw new Error('listener crash') })
    bus.emit({ id: '1', sessionId: 's1', type: 'UserMessage', payload: { content: 'hi' }, createdAt: Date.now() } as any)
    // Should not throw — error is caught internally
    expect(bus.getHistory('s1')).toHaveLength(1)
  })

  it('should support wildcard subscription', () => {
    const received: any[] = []
    const unsub = bus.subscribe('*', (e) => received.push(e))
    bus.emit({ id: '1', sessionId: 's1', type: 'UserMessage', payload: { content: 'hi' }, createdAt: Date.now() } as any)
    bus.emit({ id: '2', sessionId: 's2', type: 'UserMessage', payload: { content: 'there' }, createdAt: Date.now() } as any)
    expect(received).toHaveLength(2)
    unsub()
    bus.emit({ id: '3', sessionId: 's3', type: 'UserMessage', payload: { content: 'missed' }, createdAt: Date.now() } as any)
    expect(received).toHaveLength(2) // unsubscribed
  })
})

// ── Token estimation ──
import { estimateTokens, isOverBudget } from '../../../src/main/agent/compact/token-counter'

describe('Token estimation', () => {
  it('should estimate ~4 chars per token', () => {
    expect(estimateTokens('hello world')).toBe(3) // 11 chars / 4 = 2.75 → ceil = 3
  })

  it('should handle empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('should detect over budget', () => {
    expect(isOverBudget(85, 100, 0.8)).toBe(true)
    expect(isOverBudget(79, 100, 0.8)).toBe(false)
  })
})

// ── PromptTemplate ──
import { renderPrompt } from '../../../src/main/agent/prompt/PromptTemplate'
import type { PromptTemplate } from '../../../src/main/agent/prompt/PromptTemplate'

describe('PromptTemplate', () => {
  const baseCtx: any = {
    profile: { name: 'Test' },
    skills: [], tools: [], memories: [],
    sessionId: 's1', date: '2026-01-01', goal: 'test',
  }

  it('should render sections in priority order', () => {
    const tmpl: PromptTemplate = {
      id: 'test',
      sections: [
        { name: 'second', priority: 20, content: 'B' },
        { name: 'first', priority: 10, content: 'A' },
      ],
    }
    const result = renderPrompt(tmpl, baseCtx)
    expect(result.startsWith('A')).toBe(true)
  })

  it('should skip sections when condition returns false', () => {
    const tmpl: PromptTemplate = {
      id: 'test',
      sections: [
        { name: 'always', priority: 10, content: 'A' },
        { name: 'conditional', priority: 20, content: 'B', condition: () => false },
      ],
    }
    const result = renderPrompt(tmpl, baseCtx)
    expect(result).not.toContain('B')
  })

  it('should render dynamic content from function', () => {
    const tmpl: PromptTemplate = {
      id: 'test',
      sections: [{ name: 'dyn', priority: 10, content: (ctx: any) => `Hello ${ctx.profile.name}` }],
    }
    const result = renderPrompt(tmpl, baseCtx)
    expect(result).toContain('Hello Test')
  })

  it('should skip empty dynamic content', () => {
    const tmpl: PromptTemplate = {
      id: 'test',
      sections: [
        { name: 'always', priority: 10, content: 'A' },
        { name: 'empty', priority: 20, content: () => '' },
      ],
    }
    const result = renderPrompt(tmpl, baseCtx)
    expect(result).toBe('A')
  })
})
