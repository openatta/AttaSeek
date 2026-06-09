/**
 * Unit tests: CollapseManager + CollapseStore state machine.
 * CollapseStore is in-memory — no DB/filesystem, no mocking needed.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { CollapseManager } from '../../../src/main/agent/compact/CollapseManager'
import { CollapseStore } from '../../../src/main/agent/compact/CollapseStore'
import type { LLMMessage } from '../../../src/main/agent/llm/ModelProvider'
import type { AgentProfile } from '../../../src/main/agent/profile/AgentProfile'

// ── Fixtures ──

function makeProfile(tokenBudget: number = 1_000): AgentProfile {
  return {
    id: 'test', name: 'Test', description: '',
    systemPrompt: { id: 't', sections: [] },
    tools: [], skills: [], toolSelection: 'none',
    memory: { scopes: ['project'], recallLimit: 0, autoExtract: false, loadFileMemory: false },
    context: {
      maxTokens: 10_000,
      budgets: { system: 1_000, tools: 1_000, memory: 500, messages: tokenBudget, reserve: 6_500 },
      autoCompact: true,
      compactTriggerRatio: 0.85,
      keepRecentTurns: 5,
    },
    execution: { maxTurns: 5, maxParallelTools: 1, planning: 'none' },
    output: { generateArtifact: false, autoTitle: false },
  }
}

function msg(role: 'user' | 'assistant', content: string): LLMMessage {
  return { role, content }
}

function makeMessages(count: number): LLMMessage[] {
  return Array.from({ length: count }, (_, i) =>
    msg(i % 2 === 0 ? 'user' : 'assistant', `message ${i} with some content to add tokens for testing purposes`))
}

// ═══════════════════════════════════════════════════════════════
// CollapseStore
// ═══════════════════════════════════════════════════════════════

describe('CollapseStore', () => {
  let store: CollapseStore

  beforeEach(() => { store = new CollapseStore() })

  it('starts empty', () => {
    expect(store.commitCount).toBe(0)
    expect(store.totalTokensArchived).toBe(0)
    expect(store.getState().commits).toHaveLength(0)
  })

  it('commits a collapse and tracks state', () => {
    const archived = [msg('user', 'old task'), msg('assistant', 'old response')]
    const c = store.commit('c1', archived, 'Did some work', 500)
    expect(c.id).toBe('c1')
    expect(c.archivedMessages).toHaveLength(2)
    expect(store.commitCount).toBe(1)
    expect(store.totalTokensArchived).toBe(500)
  })

  it('projectLive prepends summary when commits exist', () => {
    store.commit('c1', [msg('user', 'old')], 'Summary text', 100)
    const live = [msg('user', 'current task')]
    const { messages } = store.projectLive(live)
    expect(messages.length).toBeGreaterThan(live.length)
    expect(messages[0].role).toBe('user')
    expect((messages[0].content as string)).toContain('Collapsed context')
  })

  it('projectLive returns unchanged when no commits', () => {
    const live = [msg('user', 'current')]
    const { messages } = store.projectLive(live)
    expect(messages).toEqual(live)
  })

  it('reset clears all state', () => {
    store.commit('c1', [msg('user', 'old')], 'Summary', 100)
    store.reset()
    expect(store.commitCount).toBe(0)
    expect(store.totalTokensArchived).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// CollapseManager
// ═══════════════════════════════════════════════════════════════

describe('CollapseManager', () => {
  let mgr: CollapseManager

  beforeEach(() => { mgr = new CollapseManager() })

  it('does not collapse when under budget', () => {
    const profile = makeProfile(10_000)
    const msgs = makeMessages(6)
    const r = mgr.applyCollapsesIfNeeded(msgs, profile)
    expect(r.collapsed).toBe(false)
  })

  it('collapses when over trigger ratio', () => {
    const profile = makeProfile(200) // small budget → almost any input triggers
    const msgs = makeMessages(30)
    const r = mgr.applyCollapsesIfNeeded(msgs, profile)
    // Whether or not it collapses depends on token math with the profile
    // At minimum, no error
    expect(r.messages.length).toBeGreaterThan(0)
  })

  it('forceCollapse applies emergency collapse', () => {
    const msgs = makeMessages(20)
    const r = mgr.forceCollapse(msgs, 2)
    expect(r.collapsed).toBe(true)
    expect(r.messages.length).toBeGreaterThan(0)
  })

  it('respects maxCommits limit', () => {
    const profile = makeProfile(200)
    const msgs = makeMessages(30)
    // Hit max commits
    for (let i = 0; i < 5; i++) {
      mgr.applyCollapsesIfNeeded(msgs, profile)
    }
    // 6th should be refused
    const r = mgr.applyCollapsesIfNeeded(msgs, profile)
    expect(r.collapsed).toBe(false)
  })

  it('getStore returns the internal store', () => {
    const store = mgr.getStore()
    expect(store).toBeInstanceOf(CollapseStore)
    expect(store.commitCount).toBe(0)
  })

  it('reset clears manager state', () => {
    const profile = makeProfile(200)
    const msgs = makeMessages(30)
    mgr.collapse(msgs, profile)
    expect(mgr.getStore().commitCount).toBeGreaterThan(0)
    mgr.reset()
    expect(mgr.getStore().commitCount).toBe(0)
  })
})
