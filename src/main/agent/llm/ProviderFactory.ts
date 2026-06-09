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

  // Primary provider
  const primary = buildProvider(
    config.interfaceType,
    baseUrl,
    apiKey,
    config.defaultModel,
    config.models,
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
      // Use first model from models list as defaultModel for secondary providers
      const sec = buildProvider(
        iface.interfaceType,
        endpointUrl,
        apiKey,
        config.defaultModel, // fallback
        config.models,       // same models list
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
