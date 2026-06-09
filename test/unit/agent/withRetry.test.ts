/**
 * Unit tests for withRetry — error classification and retry logic.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  withRetry, classifyError,
  retryOnRateLimit, retryOnOverload, retryOnServerError, retryOnNetworkError,
  FallbackTriggeredError,
} from '../../../src/main/agent/llm/withRetry'
import type { RetryReason } from '../../../src/main/agent/llm/withRetry'
import { LLMError } from '../../../src/main/agent/llm/ModelProvider'

// ── Helpers ──

function makeLLMError(code: LLMError['code'], statusCode?: number): LLMError {
  return new LLMError(code, code, statusCode)
}

function makeNetError(innerCode = 'ECONNREFUSED'): Error & { code: string } {
  const err = new Error('fetch failed') as Error & { code: string }
  err.code = innerCode
  return err
}

// ── classifyError ──

describe('classifyError', () => {
  it('classifies rate_limit (429)', () => {
    expect(classifyError(makeLLMError('rate_limit', 429))).toBe('rate_limit')
  })

  it('classifies overloaded (529)', () => {
    expect(classifyError(makeLLMError('server', 529))).toBe('overloaded')
  })

  it('classifies server_error (5xx)', () => {
    expect(classifyError(makeLLMError('server', 500))).toBe('server_error')
    expect(classifyError(makeLLMError('server', 503))).toBe('server_error')
  })

  it('classifies auth_expired (401/403)', () => {
    expect(classifyError(makeLLMError('auth', 401))).toBe('auth_expired')
    expect(classifyError(makeLLMError('auth', 403))).toBe('auth_expired')
  })

  it('classifies network errors', () => {
    expect(classifyError(makeNetError())).toBe('network_error')
    expect(classifyError(makeNetError('ENOTFOUND'))).toBe('network_error')
  })

  it('classifies unknown for unclassified errors', () => {
    expect(classifyError(makeLLMError('invalid_request', 400))).toBe('unknown')
    expect(classifyError(new Error('generic error'))).toBe('unknown')
  })
})

// ── Retry predicates ──

describe('retry predicates', () => {
  it('retryOnRateLimit detects 429', () => {
    expect(retryOnRateLimit(makeLLMError('rate_limit', 429))).toBe(true)
    expect(retryOnRateLimit(makeLLMError('server', 500))).toBe(false)
  })

  it('retryOnOverload detects 529', () => {
    expect(retryOnOverload(makeLLMError('server', 529))).toBe(true)
    expect(retryOnOverload(makeLLMError('rate_limit', 429))).toBe(false)
  })

  it('retryOnServerError detects 5xx', () => {
    expect(retryOnServerError(makeLLMError('server', 500))).toBe(true)
    expect(retryOnServerError(makeLLMError('rate_limit', 429))).toBe(false)
  })

  it('retryOnNetworkError detects network errors', () => {
    expect(retryOnNetworkError(makeNetError())).toBe(true)
    expect(retryOnNetworkError(makeLLMError('server', 500))).toBe(false)
  })
})

// ── withRetry — basic behavior ──

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on rate_limit and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(makeLLMError('rate_limit', 429))
      .mockResolvedValueOnce('ok')

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(makeLLMError('rate_limit', 429))

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 })
    ).rejects.toBeInstanceOf(LLMError)
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('does not retry on auth errors (by default)', async () => {
    const fn = vi.fn().mockRejectedValue(makeLLMError('auth', 401))

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 })
    ).rejects.toBeInstanceOf(LLMError)
    expect(fn).toHaveBeenCalledTimes(1) // no retry
  })

  it('calls onRetry callback with correct reason', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(makeLLMError('rate_limit', 429))
      .mockResolvedValueOnce('ok')
    const onRetry = vi.fn()

    await withRetry(fn, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10, onRetry })
    expect(onRetry).toHaveBeenCalledTimes(1)
    const callArgs = onRetry.mock.calls[0]
    expect(callArgs[0]).toBeInstanceOf(LLMError)
    expect(callArgs[1]).toBe(1) // attempt number
    expect(typeof callArgs[2]).toBe('number') // delayMs
    expect(callArgs[3]).toBe('rate_limit')
  })

  it('throws FallbackTriggeredError after 3+ failures with fallbackModel', async () => {
    const fn = vi.fn().mockRejectedValue(makeLLMError('server', 500))
    const onFallback = vi.fn()

    await expect(
      withRetry(fn, {
        maxRetries: 4, baseDelayMs: 1, maxDelayMs: 10,
        fallbackModel: 'claude-haiku', onFallback,
      })
    ).rejects.toBeInstanceOf(FallbackTriggeredError)
    expect(onFallback).toHaveBeenCalled()
  })

  it('respects AbortSignal during retry sleep', async () => {
    const controller = new AbortController()
    const fn = vi.fn().mockRejectedValue(makeLLMError('rate_limit', 429))

    // Abort after a short delay
    setTimeout(() => controller.abort(), 50)

    await expect(
      withRetry(fn, { maxRetries: 5, baseDelayMs: 200, maxDelayMs: 500, signal: controller.signal })
    ).rejects.toThrow()
  })

  it('retries auth errors when refreshCredentials is provided', async () => {
    const refreshCredentials = vi.fn().mockResolvedValue(true)
    const fn = vi.fn()
      .mockRejectedValueOnce(makeLLMError('auth', 401))
      .mockResolvedValueOnce('ok')

    // Need custom shouldRetry since default doesn't retry auth
    const result = await withRetry(fn, {
      maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10,
      refreshCredentials,
      shouldRetry: (_err, _attempt, _max) => true, // force retry
    })
    expect(result).toBe('ok')
    expect(refreshCredentials).toHaveBeenCalled()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('529 overloaded limits retries for foreground sources', async () => {
    const fn = vi.fn().mockRejectedValue(makeLLMError('server', 529))

    await expect(
      withRetry(fn, { maxRetries: 10, baseDelayMs: 1, maxDelayMs: 10, isForeground: true })
    ).rejects.toBeInstanceOf(LLMError)

    // Max 3 retries for 529 foreground + 1 initial = 4 total
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it('529 overloaded: background sources bail immediately', async () => {
    const fn = vi.fn().mockRejectedValue(makeLLMError('server', 529))

    await expect(
      withRetry(fn, { maxRetries: 10, baseDelayMs: 1, maxDelayMs: 10, isForeground: false })
    ).rejects.toBeInstanceOf(LLMError)

    // No retry for background 529
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

// ── Exponential backoff delay ──

describe('backoff delay', () => {
  it('doubles delay with each retry (no jitter)', async () => {
    const delays: number[] = []
    const fn = vi.fn().mockRejectedValue(makeLLMError('server', 500))
    const onRetry = vi.fn((_err, _attempt, delayMs) => {
      delays.push(delayMs)
    })

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 10000, jitter: false, onRetry })
    ).rejects.toBeInstanceOf(LLMError)

    // Exponential backoff: ~100, ~200, ~400 (without jitter)
    expect(delays[0]).toBe(100)
    expect(delays[1]).toBe(200)
    expect(delays[2]).toBe(400)
  })

  it('caps delay at maxDelayMs', async () => {
    const delays: number[] = []
    const fn = vi.fn().mockRejectedValue(makeLLMError('server', 500))
    const onRetry = vi.fn((_err, _attempt, delayMs) => {
      delays.push(delayMs)
    })

    // Use small delays: base=100ms, cap=200ms, 3 retries = 100+200+200 = 500ms total
    await expect(
      withRetry(fn, {
        maxRetries: 3, baseDelayMs: 100, maxDelayMs: 200, jitter: false, onRetry,
      })
    ).rejects.toBeInstanceOf(LLMError)

    // First retry: 100ms (under cap), second: 200ms (at cap), third: 200ms (capped)
    expect(delays[0]).toBe(100)
    expect(delays[1]).toBe(200)
    expect(delays[2]).toBe(200)
  })
})
