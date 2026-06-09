/**
 * ProviderFallback — automatic provider-level fallback chain.
 *
 * When the primary LLM provider fails (rate-limited, overloaded, auth expired),
 * this module attempts to switch to a fallback provider before giving up.
 *
 * Fallback chain priority:
 *   1. User-specified fallback model (per task / config)
 *   2. Provider's own model alias fallback (sonnet → haiku)
 *   3. Next registered provider with a different base URL (OpenAI → DeepSeek, etc.)
 *
 * Mirrors Claude Code's fallback model system (src/services/api/withRetry.ts).
 *
 * Phase E: provider-level fallback. Full model-matrix fallback deferred.
 */

import { modelProviderRegistry } from './ModelProviderRegistry'
import type { ModelProvider } from './ModelProvider'

// ── Types ──

export interface FallbackResult {
  /** The selected provider (may be the same as primary). */
  provider: ModelProvider
  /** The model name to use with this provider. */
  model: string
  /** Fallback chain path taken (for observability). */
  chain: string[]
  /** Whether a fallback actually occurred. */
  didFallback: boolean
}

export interface FallbackConfig {
  /** User-specified fallback model name. */
  fallbackModel?: string
  /** Preferred provider ID. */
  preferredProviderId?: string
  /** Whether to try other providers (not just model aliases). */
  tryOtherProviders: boolean
}

const DEFAULT_CONFIG: FallbackConfig = {
  tryOtherProviders: true,
}

// ── Core ──

/**
 * Resolve the fallback chain for a failing provider call.
 *
 * @param primaryProviderId — the provider ID that failed
 * @param primaryModel — the model that was being used
 * @param error — the error that caused the failure (used to decide strategy)
 * @param config — fallback configuration
 * @returns FallbackResult with the next provider+model to try
 */
export function resolveFallback(
  primaryProviderId: string,
  primaryModel: string,
  error?: unknown,
  config: Partial<FallbackConfig> = {},
): FallbackResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const chain: string[] = [primaryModel]
  const code = (error as { code?: string })?.code

  // Only fallback for overload/rate-limit/server errors
  const shouldFallback = code === 'overloaded' || code === 'rate_limit' || code === 'server' || code === 'unknown'
  if (!shouldFallback) {
    const provider = modelProviderRegistry.getById(primaryProviderId)
    return {
      provider: provider || modelProviderRegistry.getDefault()!,
      model: primaryModel,
      chain,
      didFallback: false,
    }
  }

  // Step 1: User-specified fallback model (with same provider)
  if (cfg.fallbackModel && cfg.fallbackModel !== primaryModel) {
    const provider = modelProviderRegistry.getById(primaryProviderId)
    if (provider) {
      chain.push(cfg.fallbackModel)
      return { provider, model: cfg.fallbackModel, chain, didFallback: true }
    }
  }

  // Step 2: Try another provider (same interface type preferred)
  if (cfg.tryOtherProviders) {
    const altProvider = findAlternativeProvider(primaryProviderId)
    if (altProvider) {
      chain.push(`${altProvider.id}/${primaryModel}`)
      return { provider: altProvider.provider, model: primaryModel, chain, didFallback: true }
    }
  }

  // Step 3: Try the default provider if different
  const defaultProvider = modelProviderRegistry.getDefault()
  const defaultId = modelProviderRegistry.getDefaultId()
  if (defaultProvider && defaultId !== primaryProviderId) {
    chain.push(`${defaultId}/${primaryModel}`)
    return { provider: defaultProvider, model: primaryModel, chain, didFallback: true }
  }

  // No fallback available
  const primary = modelProviderRegistry.getById(primaryProviderId)
  return {
    provider: primary || modelProviderRegistry.getDefault()!,
    model: primaryModel,
    chain,
    didFallback: false,
  }
}

/**
 * Find an alternative provider with a different ID than the failing one.
 * Prefers same interface type, but accepts any.
 */
function findAlternativeProvider(
  excludeId: string,
): { id: string; provider: ModelProvider } | null {
  const allIds = modelProviderRegistry.listIds()
  for (const id of allIds) {
    if (id === excludeId) continue
    const provider = modelProviderRegistry.getById(id)
    if (provider) {
      return { id, provider }
    }
  }
  return null
}
