/**
 * ProviderFactory — creates ModelProvider instances.
 *
 * Each ModelConfig may declare additional interfaces (e.g. DeepSeek pro uses
 * Anthropic format while chat/flash use OpenAI-compatible). This factory
 * creates a primary provider for the main interface, plus secondary providers
 * for each entry in config.interfaces.
 *
 * Extracted from ModelConfigService to break a circular dependency:
 *   ModelConfigService → ModelProvider ← OpenAICompatibleProvider
 *   ModelConfigService → require(OpenAICompatibleProvider)  ← WAS the cycle
 *
 * By moving creation to this standalone module, neither ModelConfigService
 * nor OpenAICompatibleProvider directly import each other.
 */

import { AnthropicProvider } from './AnthropicProvider'
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider'
import type { ModelProvider } from './ModelProvider'
import type { ModelConfig, ProviderInterface } from '../../../shared/types/model'

/** A provider instance + the ID it should be registered under + its interface type. */
export interface ProviderEntry {
  id: string
  provider: ModelProvider
  interfaceType: 'openai_compatible' | 'anthropic'
}

function buildProvider(
  interfaceType: 'openai_compatible' | 'anthropic',
  endpointUrl: string,
  apiKey: string,
  defaultModel: string,
  models: string[],
  extraParams?: Record<string, unknown>,
): ModelProvider | null {
  try {
    if (interfaceType === 'anthropic') {
      return new AnthropicProvider(apiKey, models, endpointUrl)
    }
    return new OpenAICompatibleProvider(endpointUrl, apiKey, defaultModel, extraParams)
  } catch (err) {
    console.error('[ProviderFactory] failed to create provider:', err)
    return null
  }
}

/**
 * Create ALL providers from a ModelConfig — primary + secondary interfaces.
 * Returns an array of { id, provider, interfaceType } entries for registration.
 */
export function createAllProviders(config: ModelConfig, apiKey: string): ProviderEntry[] {
  const entries: ProviderEntry[] = []
  const baseUrl = config.endpointUrl

  // Primary provider — only lists non-reasoning models (secondary gets pro ones)
  const secondaryProModels = new Set(
    config.interfaces
      ? Object.values(config.interfaces)
          .filter(i => i && typeof i === 'object' && i.interfaceType !== config.interfaceType)
          .flatMap(() => config.models.filter(m => m.includes('-pro') || m === config.opusModel))
      : []
  )
  const primaryModels = config.models.filter(m => !secondaryProModels.has(m))
  const primary = buildProvider(
    config.interfaceType,
    baseUrl,
    apiKey,
    config.defaultModel,
    primaryModels.length > 0 ? primaryModels : config.models,
    config.extraParams,
  )
  if (primary) {
    entries.push({ id: config.id, provider: primary, interfaceType: config.interfaceType })
  }

  // Secondary interfaces
  if (config.interfaces) {
    for (const [key, iface] of Object.entries(config.interfaces)) {
      if (!iface || typeof iface !== 'object') continue
      const endpointUrl = iface.endpointUrl || baseUrl
      // Filter models: secondary interface handles reasoning models (pro/opus),
      // primary handles all others. This ensures findProviderForModel routes
      // each model to the correct interface.
      const secondaryModels = config.models.filter(m =>
        m.includes('-pro') || m.includes('opus') || m === config.opusModel
      )
      if (secondaryModels.length === 0) continue
      const sec = buildProvider(
        iface.interfaceType,
        endpointUrl,
        apiKey,
        secondaryModels[0],
        secondaryModels,
        { ...config.extraParams, ...iface.extraParams },
      )
      if (sec) {
        entries.push({ id: `${config.id}_${key}`, provider: sec, interfaceType: iface.interfaceType })
      }
    }
  }

  return entries
}

// Keep backward compatibility
export function createProvider(config: ModelConfig, apiKey: string): ModelProvider | null {
  const entries = createAllProviders(config, apiKey)
  return entries.length > 0 ? entries[0].provider : null
}
