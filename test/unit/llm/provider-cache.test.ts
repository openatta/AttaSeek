/**
 * Unit tests: ProviderFallback + PromptCache.
 * ProviderFallback needs a populated ModelProviderRegistry.
 * PromptCache pure functions need no mocking.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resolveFallback } from '../../../src/main/agent/llm/ProviderFallback'
import {
  buildCacheKey, splitSystemPrompt, preparePromptCache,
  registerCacheKey, lookupCacheKey, clearCacheRegistry,
} from '../../../src/main/agent/llm/PromptCache'
import { modelProviderRegistry } from '../../../src/main/agent/llm/ModelProviderRegistry'
import type { ModelProvider, LLMChatParams, LLMChatResult, LLMChunkCallback } from '../../../src/main/agent/llm/ModelProvider'

// ── Lightweight mock provider (no SDK init) ──

function makeMockProvider(name: string, models: string[]): ModelProvider {
  return {
    name,
    models,
    chat: async (_p: LLMChatParams) => ({ content: [], stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0 } }),
    chatStream: async (_p: LLMChatParams, _cb: LLMChunkCallback) => ({ content: [], stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0 } }),
    validateKey: async () => true,
  }
}

// ═══════════════════════════════════════════════════════════════
// ProviderFallback
// ═══════════════════════════════════════════════════════════════

describe('ProviderFallback', () => {
  beforeEach(() => {
    // Clean up any stale providers from other tests
    for (const id of modelProviderRegistry.listIds()) {
      modelProviderRegistry.unregister(id)
    }
    // Register two mock providers (no SDK init)
    modelProviderRegistry.registerById('primary', makeMockProvider('Primary', ['claude-sonnet']), {
      name: 'Primary Anthropic', interfaceType: 'anthropic', models: ['claude-sonnet'],
    })
    modelProviderRegistry.registerById('secondary', makeMockProvider('Secondary', ['gpt-4o']), {
      name: 'Secondary OpenAI', interfaceType: 'openai_compatible', models: ['gpt-4o'],
    })
    modelProviderRegistry.setDefault('primary')
  })

  describe('resolveFallback', () => {
    it('returns primary provider when error is not retryable', () => {
      const r = resolveFallback('primary', 'claude-sonnet', { code: 'auth' })
      expect(r.didFallback).toBe(false)
      expect(r.provider).toBeDefined()
      expect(r.model).toBe('claude-sonnet')
    })

    it('uses user-specified fallback model with same provider on overload', () => {
      const r = resolveFallback('primary', 'claude-sonnet', { code: 'overloaded' }, {
        fallbackModel: 'claude-haiku',
      })
      expect(r.didFallback).toBe(true)
      expect(r.model).toBe('claude-haiku')
      expect(r.chain).toContain('claude-haiku')
    })

    it('falls back to alternative provider when no user fallback', () => {
      const r = resolveFallback('primary', 'claude-sonnet', { code: 'server' })
      expect(r.didFallback).toBe(true)
      expect(r.model).toBe('claude-sonnet') // same model name, different provider
    })

    it('returns primary on rate_limit with tryOtherProviders', () => {
      const r = resolveFallback('primary', 'claude-sonnet', { code: 'rate_limit' })
      expect(r.didFallback).toBe(true)
    })

    it('does not fallback for unknown with specific codes', () => {
      const r = resolveFallback('primary', 'claude-sonnet', { code: 'invalid_request' })
      expect(r.didFallback).toBe(false)
    })

    it('tracks fallback chain', () => {
      const r = resolveFallback('primary', 'claude-sonnet', { code: 'overloaded' }, {
        fallbackModel: 'claude-haiku',
      })
      expect(r.chain.length).toBeGreaterThan(1)
    })

    it('returns provider even when registry is empty-ish (no alternative)', () => {
      // Only primary is registered, no secondary → falls back to default (which is primary)
      modelProviderRegistry.unregister('secondary')
      const r = resolveFallback('primary', 'claude-sonnet', { code: 'server' })
      // May or may not fallback depending on remaining providers
      expect(r.provider).toBeDefined()
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// PromptCache — pure functions
// ═══════════════════════════════════════════════════════════════

describe('PromptCache', () => {
  describe('buildCacheKey', () => {
    it('produces deterministic keys', () => {
      const k1 = buildCacheKey('coding', ['read_file', 'bash'], 'claude-sonnet')
      const k2 = buildCacheKey('coding', ['read_file', 'bash'], 'claude-sonnet')
      expect(k1).toBe(k2)
      expect(k1).toHaveLength(16) // hex prefix
    })

    it('produces different keys for different profiles', () => {
      const k1 = buildCacheKey('coding', ['read_file'], 'claude-sonnet')
      const k2 = buildCacheKey('research', ['read_file'], 'claude-sonnet')
      expect(k1).not.toBe(k2)
    })

    it('same tool set in different order produces same key', () => {
      const k1 = buildCacheKey('coding', ['bash', 'read_file', 'edit_file'], 'claude-sonnet')
      const k2 = buildCacheKey('coding', ['edit_file', 'bash', 'read_file'], 'claude-sonnet')
      expect(k1).toBe(k2) // tools sorted internally
    })
  })

  describe('splitSystemPrompt', () => {
    it('splits at Session Info boundary', () => {
      const prompt = 'Identity section\n\n## Session Info\nSession ID: s1\nDate: 2026-06-07'
      const { prefix, suffix } = splitSystemPrompt(prompt)
      expect(prefix).toContain('Identity section')
      expect(prefix).not.toContain('Session Info')
      expect(suffix).toContain('Session ID')
      expect(suffix).toContain('2026-06-07')
    })

    it('returns whole prompt as prefix when no boundary', () => {
      const prompt = 'Just a simple prompt without session info'
      const { prefix, suffix } = splitSystemPrompt(prompt)
      expect(prefix).toBe(prompt)
      expect(suffix).toBe('')
    })
  })

  describe('preparePromptCache', () => {
    const config = {
      enabled: true,
      profileId: 'coding',
      toolNames: ['read_file', 'bash'],
      modelId: 'claude-sonnet',
    }

    it('returns cache key + split prompt when enabled', () => {
      const prompt = 'Identity\n\n## Session Info\nSession: s1'
      const info = preparePromptCache(prompt, config)
      expect(info.key).toHaveLength(16)
      expect(info.systemPrefix).toContain('Identity')
      expect(info.systemSuffix).toContain('Session Info')
    })

    it('returns full prompt as prefix when disabled', () => {
      const prompt = 'Identity\n\n## Session Info\nSession: s1'
      const info = preparePromptCache(prompt, { ...config, enabled: false })
      expect(info.systemPrefix).toBe(prompt)
      expect(info.systemSuffix).toBe('')
      expect(info.toolsWithCacheMarkers).toHaveLength(0)
    })
  })

  describe('cache key registry', () => {
    beforeEach(() => { clearCacheRegistry() })

    it('registers and looks up cache keys', () => {
      const key = registerCacheKey({
        enabled: true, profileId: 'coding',
        toolNames: ['read_file'], modelId: 'claude-sonnet',
      })
      const found = lookupCacheKey('coding', 'claude-sonnet')
      expect(found).toBe(key)
    })

    it('returns undefined for unknown profile+model', () => {
      expect(lookupCacheKey('nonexistent', 'claude-sonnet')).toBeUndefined()
    })

    it('clearCacheRegistry removes all entries', () => {
      registerCacheKey({
        enabled: true, profileId: 'coding',
        toolNames: ['read_file'], modelId: 'claude-sonnet',
      })
      clearCacheRegistry()
      expect(lookupCacheKey('coding', 'claude-sonnet')).toBeUndefined()
    })
  })
})
