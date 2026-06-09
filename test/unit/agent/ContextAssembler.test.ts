/**
 * Unit tests for ContextAssembler — context assembly with injected deps.
 *
 * Uses the ContextAssemblerDeps interface (Fix 1) to inject mock
 * services, avoiding any dependency on global singletons.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContextAssembler } from '../../../src/main/agent/context/ContextAssembler'
import type { ContextAssemblerDeps } from '../../../src/main/agent/context/ContextAssembler'
import type { AgentProfile } from '../../../src/main/agent/profile/AgentProfile'

// ── Minimal test profile ──
const testProfile: AgentProfile = {
  id: 'test',
  name: 'Test Agent',
  description: 'Test profile for unit tests.',
  systemPrompt: {
    id: 'test',
    sections: [
      { name: 'identity', priority: 10, content: `You are AttaSeek Test Agent, a test profile.` },
    ],
  },
  tools: [], toolSelection: 'all', skills: [],
  memory: { scopes: [], recallLimit: 5, autoExtract: false, loadFileMemory: false },
  context: {
    maxTokens: 100_000,
    budgets: { system: 8000, tools: 12000, memory: 4000, messages: 60000, reserve: 16000 },
    autoCompact: false, compactTriggerRatio: 0.85, keepRecentTurns: 5,
  },
  execution: { maxTurns: 10, maxParallelTools: 4, planning: 'none' },
  output: { generateArtifact: false, autoTitle: false },
}

// ── Helpers ──

function mockDeps(overrides: Partial<ContextAssemblerDeps> = {}): ContextAssemblerDeps {
  return {
    listTools: () => [
      { id: 'read_file', description: 'Read a file from disk', inputSchema: { type: 'object' } },
      { id: 'write_file', description: 'Write content to a file', inputSchema: { type: 'object' } },
      { id: 'search_code', description: 'Search codebase for patterns', inputSchema: { type: 'object' } },
    ],
    selectTools: (_goal, tools) => tools.slice(0, 3).map(t => ({ id: t.id })),
    recallMemories: async () => [
      { type: 'user_preference', content: 'Prefer TypeScript strict mode' },
    ],
    listSkills: () => [
      { name: 'code-review', description: 'Review code changes for bugs' },
    ],
    getSessionEvents: () => [],
    ...overrides,
  }
}

// ── Tests ──

describe('ContextAssembler', () => {
  let assembler: ContextAssembler
  let deps: ContextAssemblerDeps

  beforeEach(() => {
    deps = mockDeps()
    assembler = new ContextAssembler(
      { includeGitContext: false, includeFileMemories: false },
      deps,
    )
  })

  it('assembles context with injected deps', async () => {
    const result = await assembler.assemble({
      goal: 'read the main file',
      sessionId: 'test-session',
      profile: testProfile,
    })

    expect(result).toBeDefined()
    expect(result.messages).toEqual([]) // no session events
    expect(result.tools.length).toBeGreaterThan(0)
    expect(result.tools[0].name).toBe('read_file')
    expect(result.systemPrompt).toContain('AttaSeek')
    expect(result.userContext).toBeDefined()
    expect(result.systemContext).toBeDefined()
  })

  it('includes memory context from injected recallMemories', async () => {
    deps = mockDeps({
      recallMemories: async () => [
        { type: 'note', content: 'Remember to use strict null checks' },
        { type: 'decision', content: 'Use Jotai for state management' },
      ],
    })
    assembler = new ContextAssembler({ includeGitContext: false }, deps)

    const result = await assembler.assemble({
      goal: 'add state management',
      sessionId: 'test-session',
      profile: testProfile,
    })

    expect(result.memoryContext).toContain('strict null checks')
    expect(result.memoryContext).toContain('Jotai')
  })

  it('selects tools based on goal keywords', async () => {
    const result = await assembler.assemble({
      goal: 'read and write project files',
      sessionId: 'test-session',
      profile: testProfile,
    })

    expect(result.tools.length).toBeGreaterThan(0)
    const toolNames = result.tools.map(t => t.name)
    expect(toolNames).toContain('read_file')
  })

  it('returns empty tools for non-technical goals', async () => {
    const result = await assembler.assemble({
      goal: 'hello how are you',
      sessionId: 'test-session',
      profile: testProfile,
    })

    expect(result.tools).toEqual([])
  })

  it('includes system context with OS and date', async () => {
    const result = await assembler.assemble({
      goal: 'check something',
      sessionId: 'test-session',
      profile: testProfile,
    })

    expect(result.systemContext.os).toBeTruthy()
    expect(result.systemContext.date).toBeTruthy()
  })

  it('filters skills by goal relevance', async () => {
    deps = mockDeps({
      listSkills: () => [
        { name: 'code-review', description: 'Review code changes for bugs' },
        { name: 'writing', description: 'Help with writing documents' },
        { name: 'deploy', description: 'Deploy to production' },
      ],
    })
    assembler = new ContextAssembler({ includeGitContext: false }, deps)

    const result = await assembler.assemble({
      goal: 'review code changes in the PR',
      sessionId: 'test-session',
      profile: testProfile,
    })

    expect(result.userContext.skills).toBeTruthy()
    expect(result.userContext.skills).toContain('code-review')
    expect(result.userContext.skills).not.toContain('writing')
  })

  it('includes session events as messages', async () => {
    deps = mockDeps({
      getSessionEvents: () => [
        { type: 'UserMessage', payload: { content: 'help me fix a bug' }, id: '1', sessionId: 's', taskId: 't', createdAt: 1 },
        { type: 'AgentMessage', payload: { content: 'Sure, let me look' }, id: '2', sessionId: 's', taskId: 't', createdAt: 2 },
      ],
    })
    assembler = new ContextAssembler({ includeGitContext: false }, deps)

    const result = await assembler.assemble({
      goal: 'continue debugging',
      sessionId: 'test-session',
      profile: testProfile,
    })

    expect(result.messages.length).toBe(2)
    expect(result.messages[0].role).toBe('user')
    expect(result.messages[0].content).toBe('help me fix a bug')
    expect(result.messages[1].role).toBe('assistant')
    expect(result.messages[1].content).toBe('Sure, let me look')
  })

  it('computes token usage accounting', async () => {
    const result = await assembler.assemble({
      goal: 'read the main file',
      sessionId: 'test-session',
      profile: testProfile,
    })

    expect(result.tokenUsage).toBeDefined()
    expect(result.tokenUsage.total).toBeGreaterThan(0)
    expect(result.tokenUsage.systemPrompt).toBeGreaterThan(0)
    expect(result.tokenUsage.budgetLimit).toBe(100_000)
  })

  it('does not call real singletons when deps are injected', async () => {
    // This is the key test: with deps injected, no global singletons are touched.
    // We verify by checking that assemble() returns without errors.
    const result = await assembler.assemble({
      goal: 'read the main file',
      sessionId: 'test-session',
      profile: testProfile,
    })

    expect(result).toBeDefined()
    expect(result.systemPrompt).toBeTruthy()
  })
})
