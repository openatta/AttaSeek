/**
 * ProviderFactory — creates LLM provider instances.
 *
 * Extracted from ModelConfigService to break a circular dependency:
 *   ModelConfigService → LLMProvider ← OpenAICompatibleProvider
 *   ModelConfigService → require(OpenAICompatibleProvider)  ← WAS the cycle
 *
 * By moving creation to this standalone module, neither ModelConfigService
 * nor OpenAICompatibleProvider directly import each other.
 */

import { AnthropicProvider } from './AnthropicProvider'
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider'
import type { LLMProvider } from './LLMProvider'
import type { ModelConfig } from '../../../shared/types/model'

export function createProvider(config: ModelConfig, apiKey: string): LLMProvider | null {
  try {
    if (config.interfaceType === 'anthropic') {
      return new AnthropicProvider(apiKey)
    }
    return new OpenAICompatibleProvider(config.endpointUrl, apiKey, config.defaultModel, config.extraParams)
  } catch (err) {
    console.error(`[ProviderFactory] failed to create provider for ${config.id}:`, err)
    return null
  }
}
