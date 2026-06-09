/**
 * withRetry — generic retry wrapper with exponential backoff.
 *
 * Phase E upgrades (from Phase A):
 *   - Max retries: 3 → 10 (aligns with Claude Code)
 *   - 529 Overloaded: foreground sources retry (max 3), background bail immediately
 *   - Fallback model: auto-switch on repeated 529/server errors
 *   - Retry reason tracking: each retry logs the specific reason
 *   - Auth expiry: auto-clear credential cache on 401
 *
 * Used by LLM providers (AnthropicProvider, OpenAICompatibleProvider) to
 * handle transient API failures.
 */

// ── Types ──

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 10). */
  maxRetries?: number
  /** Base delay between retries in ms (default: 500). */
  baseDelayMs?: number
  /** Maximum delay cap in ms (default: 60_000). */
  maxDelayMs?: number
  /** Whether to add jitter to delay (default: true). */
  jitter?: boolean
  /** Custom retry predicate — receives the thrown error, returns true to retry */
  shouldRetry?: (err: unknown, attempt: number, maxRetries: number) => boolean
  /** Called before each retry attempt with (error, attemptNumber, delayMs, reason) */
  onRetry?: (err: unknown, attempt: number, delayMs: number, reason: RetryReason) => void
  /** Whether this is a foreground source (user is waiting). Affects 529 behavior. */
  isForeground?: boolean
  /** Fallback model name to try on repeated failures. */
  fallbackModel?: string
  /** Called when the fallback model is activated. */
  onFallback?: (model: string, reason: string) => void
  /** Called periodically during long retry waits to keep the host alive. */
  onHeartbeat?: (remainingMs: number) => void
  /** Optional AbortSignal for cancellation during sleep. */
  signal?: AbortSignal
  /** Optional credential refresh function. Called before retrying on 401/403.
   *  Returns true if credentials were successfully refreshed. */
  refreshCredentials?: () => Promise<boolean>
}

/** Check if an error indicates expired credentials. */
export function isCredentialExpiredError(err: unknown): boolean {
  const code = (err as any)?.code
  const status = (err as any)?.status ?? (err as any)?.statusCode
  if (status === 401 || status === 403) return true
  if (code === 'CredentialsProviderError' || code === 'invalid_grant') return true
  return false
}

export type RetryReason =
  | 'rate_limit'       // 429
  | 'overloaded'       // 529
  | 'server_error'     // 5xx
  | 'network_error'    // DNS / TCP / timeout
  | 'auth_expired'     // 401 / credential expired
  | 'unknown'          // Unclassified transient error

// ── Constants ──

const DEFAULT_MAX_RETRIES = 10
const DEFAULT_BASE_DELAY_MS = 500
const DEFAULT_MAX_DELAY_MS = 60_000
const MAX_529_RETRIES = 3

// ── Core ──

/**
 * Execute an async function with retry logic.
 * Returns the function's result on success, throws the last error if all retries exhausted.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const maxDelayMs = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
  const useJitter = opts.jitter ?? true
  const isForeground = opts.isForeground ?? true

  let lastError: unknown
  let consecutive529s = 0

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt)
    } catch (err) {
      lastError = err

      if (attempt >= maxRetries) break

      // Classify error and decide whether to retry
      const reason = classifyError(err)
      const shouldRetry = opts.shouldRetry
        ? opts.shouldRetry(err, attempt, maxRetries)
        : defaultShouldRetry(reason, isForeground, consecutive529s)

      if (!shouldRetry) break

      // Track 529s for foreground cap
      if (reason === 'overloaded') consecutive529s++

      // Attempt credential refresh on auth errors before retry
      if (reason === 'auth_expired' && opts.refreshCredentials) {
        try {
          const refreshed = await opts.refreshCredentials()
          if (refreshed) {
            opts.onRetry?.(err, attempt + 1, 0, 'auth_expired')
            continue // Retry immediately with fresh credentials
          }
        } catch { /* refresh failed — fall through to normal retry */ }
      }

      // Calculate delay
      const delayMs = getRetryDelay(err, attempt, baseDelayMs, maxDelayMs, useJitter)

      opts.onRetry?.(err, attempt + 1, delayMs, reason)

      // Fallback model on repeated failures
      if (opts.fallbackModel && attempt >= 3 && (reason === 'overloaded' || reason === 'server_error')) {
        opts.onFallback?.(opts.fallbackModel, reason)
        // The caller should re-invoke withRetry with the fallback model.
        // We throw a specific error to signal this.
        throw new FallbackTriggeredError(opts.fallbackModel, reason)
      }

      await sleepWithHeartbeat(delayMs, opts.signal, opts.onHeartbeat)
    }
  }

  throw lastError
}

// ── Error classification ──

/** Classify an error into a RetryReason. */
export function classifyError(err: unknown): RetryReason {
  const status = extractStatus(err)

  if (status === 429) return 'rate_limit'
  if (status === 529) return 'overloaded'
  if (status === 401 || status === 403) return 'auth_expired'
  if (status !== undefined && status >= 500 && status < 600) return 'server_error'
  if (isNetworkError(err)) return 'network_error'
  return 'unknown'
}

/** Default retry predicate: retry everything except auth_expired. */
function defaultShouldRetry(
  reason: RetryReason,
  isForeground: boolean,
  consecutive529s: number,
): boolean {
  // Never retry auth errors — they need user action
  if (reason === 'auth_expired') return false

  // 529: foreground sources retry (capped at 3), background sources bail immediately
  if (reason === 'overloaded') {
    return isForeground && consecutive529s < MAX_529_RETRIES
  }

  // Everything else: retry
  return true
}

// ── Delay calculation ──

/** Calculate the delay before the next retry. */
function getRetryDelay(
  err: unknown,
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  useJitter: boolean,
): number {
  // Use server-suggested delay if available
  const resetDelay = extractRateLimitDelay(err)
  if (resetDelay !== undefined) {
    return Math.min(resetDelay, maxDelayMs)
  }

  // Exponential backoff with optional jitter
  return computeDelay(attempt, baseDelayMs, maxDelayMs, useJitter)
}

// ── Built-in predicates (exported for use in shouldRetry overrides) ──

/** 429 Too Many Requests. */
export function retryOnRateLimit(err: unknown): boolean {
  return extractStatus(err) === 429
}

/** 529 Overloaded (Anthropic-specific). */
export function retryOnOverload(err: unknown): boolean {
  return extractStatus(err) === 529
}

/** 5xx server errors. */
export function retryOnServerError(err: unknown): boolean {
  const status = extractStatus(err)
  return status !== undefined && status >= 500 && status < 600
}

/** Network/connection errors (no HTTP status). */
export function retryOnNetworkError(err: unknown): boolean {
  return isNetworkError(err)
}

/** Check if an error is likely retryable. */
export function isRetryable(err: unknown): boolean {
  const reason = classifyError(err)
  return reason !== 'auth_expired'
}

// ── Rate-limit delay extraction ──

function extractRateLimitDelay(err: unknown): number | undefined {
  // Anthropic unified reset header
  const unifiedReset = extractHeader(err, 'anthropic-ratelimit-unified-reset')
  if (unifiedReset) {
    const seconds = Number(unifiedReset)
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000
    }
  }

  // Standard rate-limit reset headers
  const reset = extractHeader(err, 'x-ratelimit-reset')
    ?? extractHeader(err, 'ratelimit-reset')
    ?? extractHeader(err, 'retry-after')
  if (reset) {
    const resetSeconds = Number(reset)
    if (Number.isFinite(resetSeconds)) {
      // If it looks like a timestamp (> 1_000_000), compute delta
      if (resetSeconds > 1_000_000_000) {
        return Math.max(0, resetSeconds * 1000 - Date.now())
      }
      // Otherwise treat as seconds
      return resetSeconds * 1000
    }
  }

  return undefined
}

// ── Internal helpers ──

function computeDelay(attempt: number, base: number, max: number, jitter: boolean): number {
  const exponential = Math.min(base * Math.pow(2, attempt), max)
  if (!jitter) return exponential
  return Math.random() * exponential
}

/** Minimum delay (ms) before heartbeat chunks kick in. Shorter delays don't need chunking. */
const HEARTBEAT_INTERVAL_MS = 30_000

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Sleep with heartbeat callbacks for long waits.
 * When delay exceeds HEARTBEAT_INTERVAL_MS, the sleep is chunked and
 * `onHeartbeat` is called after each chunk. This prevents host environments
 * from marking the process as hung during extended API backoff periods.
 */
async function sleepWithHeartbeat(
  ms: number,
  signal?: AbortSignal,
  onHeartbeat?: (remainingMs: number) => void,
): Promise<void> {
  if (ms <= HEARTBEAT_INTERVAL_MS || !onHeartbeat) {
    return sleep(ms)
  }
  let remaining = ms
  while (remaining > 0) {
    if (signal?.aborted) return
    const chunk = Math.min(remaining, HEARTBEAT_INTERVAL_MS)
    await sleep(chunk)
    remaining -= chunk
    if (remaining > 0) {
      onHeartbeat(remaining)
    }
  }
}

function extractStatus(err: unknown): number | undefined {
  if (err instanceof Error) {
    const e = err as unknown as Record<string, unknown>
    if (typeof e.status === 'number') return e.status
    if (typeof e.statusCode === 'number') return e.statusCode
  }
  const nested = tryNested(err, 'error', 'status') ?? tryNested(err, 'status')
  return typeof nested === 'number' ? nested : undefined
}

function extractHeader(err: unknown, name: string): string | undefined {
  const headers = tryNested(err, 'headers')
  if (headers && typeof headers === 'object') {
    const h = headers as Record<string, unknown>
    const val = h[name] ?? h[name.toLowerCase()]
    return typeof val === 'string' ? val : undefined
  }
  return undefined
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('fetch failed') || msg.includes('econnrefused') || msg.includes('enotfound')) return true
    if (msg.includes('socket hang up') || msg.includes('request timeout') || msg.includes('network')) return true
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'ECONNREFUSED') return true
  }
  return false
}

function tryNested(obj: unknown, ...path: string[]): unknown {
  if (obj === null || obj === undefined) return undefined
  let current: unknown = obj
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

// ── Fallback signal ──

/**
 * Thrown by withRetry when a fallback model should be used.
 * The caller catches this and re-invokes the LLM call with the fallback model.
 */
export class FallbackTriggeredError extends Error {
  readonly fallbackModel: string
  readonly reason: RetryReason

  constructor(fallbackModel: string, reason: RetryReason) {
    super(`Fallback triggered: switching to ${fallbackModel} due to ${reason}`)
    this.name = 'FallbackTriggeredError'
    this.fallbackModel = fallbackModel
    this.reason = reason
  }
}
