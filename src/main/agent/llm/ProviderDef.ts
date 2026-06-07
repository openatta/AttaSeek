/**
 * ProviderDef — shared types for the Atta LLM provider configuration model.
 *
 * Matches the schema defined in AttaMeta/docs/LLM_CONFIG.md.
 * All configuration is text-file based (JSON); no SQLite involvement.
 *
 * ## Type mapping: ProviderDef ↔ ModelConfig
 *
 * These are parallel representations of the same data, used in different layers:
 *
 * | Concept              | ProviderDef (JSON layer)     | ModelConfig (IPC/UI layer)   |
 * |----------------------|------------------------------|------------------------------|
 * | Provider identity    | `id`, `name`                 | `id`, `name`                 |
 * | API protocol         | `interfaces` map             | `interfaceType` + `endpointUrl` |
 * | Auth                 | `auth_token`                 | (apiKey param, not on ModelConfig) |
 * | Main model           | `model`                      | `defaultModel`               |
 * | Three-tier slots     | `opus_model`, `sonnet_model`, `haiku_model` | `opusModel`, `sonnetModel`, `haikuModel` |
 * | Extended slots       | `subagent_model`, `small_fast_model`, etc. | `subagentModel`, `smallFastModel`, etc. |
 * | Options              | `effort_level`, `max_tokens`, `compact_threshold` | `effortLevel`, `maxTokens`, `compactThreshold` |
 * | Timestamps           | `created_at`, `updated_at`   | `createdAt`, `updatedAt`     |
 *
 * Conversion functions: `providerToModelConfig()` / `configToProviderDef()` in ModelConfigService.
 * When adding a new field, update BOTH types AND both conversion functions.
 */

export type ApiType = 'anthropic' | 'openai_compatible'

// ── Raw provider definition (as read from ~/.atta/settings.json) ──

export interface ProviderDef {
  id: string
  name: string
  /** API interfaces this provider supports, keyed by api_type → base_url.
   *  e.g. { "anthropic": "https://api.deepseek.com/anthropic", "openai_compatible": "https://api.deepseek.com/v1" } */
  interfaces?: Record<string, string>
  /** Legacy compat: single api_type (normalized to interfaces on load) */
  api_type?: ApiType
  /** Legacy compat: single base_url (normalized to interfaces on load) */
  base_url?: string
  auth_token: string
  /** Main model — the ultimate fallback for all slots */
  model: string
  // Three-tier model slots
  opus_model?: string
  sonnet_model?: string
  haiku_model?: string
  // Extended slots
  small_fast_model?: string
  subagent_model?: string
  strong_model?: string
  fallback_model?: string
  classifier_model?: string
  compact_model?: string
  // Options
  effort_level?: string
  max_tokens?: number
  compact_threshold?: number
  // Timestamps (set on first save, updated on each modification)
  created_at?: number
  updated_at?: number
}

// ── Slot names (semantic roles, not concrete model names) ──

export type SlotName =
  | 'model'       // Main / ultimate fallback
  | 'opus'        // Deep thinking
  | 'sonnet'      // Primary coding
  | 'haiku'       // Lightweight / fast
  | 'subagent'    // Sub-agent default
  | 'small_fast'  // Quick tool calls
  | 'strong'      // Auto-routing upgrade target
  | 'fallback'    // Overload fallback
  | 'classifier'  // Permission auto-classifier
  | 'compact'     // Context compaction summary

// ── Resolved provider (all slots resolved to concrete model names) ──

export interface ResolvedProvider {
  /** Original provider definition */
  def: ProviderDef
  /** The selected api_type (from app config, or first in interfaces) */
  apiType: ApiType
  /** The base_url for the selected api_type */
  baseUrl: string
  authToken: string
  /** Resolved model name for each slot */
  model: string
  opus: string
  sonnet: string
  haiku: string
  subagent: string
  smallFast: string
  strong: string
  fallback: string
  classifier: string
  compact: string
  /** Options */
  effortLevel?: string
  maxTokens?: number
  compactThreshold?: number
}

// ── Slot fallback chain definition ──

/**
 * Each slot has a fallback chain: [primary, secondary, ..., terminal].
 * The terminal is always 'model'. Resolution stops at the first defined value.
 */
export const SLOT_FALLBACK_CHAINS: Record<SlotName, SlotName[]> = {
  model:      ['model'],
  opus:       ['opus', 'model'],
  sonnet:     ['sonnet', 'model'],
  haiku:      ['haiku', 'model'],
  subagent:   ['subagent', 'sonnet', 'model'],
  small_fast: ['small_fast', 'haiku', 'model'],
  strong:     ['strong', 'opus', 'model'],
  fallback:   ['fallback', 'opus', 'model'],
  classifier: ['classifier', 'haiku', 'model'],
  compact:    ['compact', 'haiku', 'model'],
}

// ── ProviderDef field name per slot ──

export const SLOT_FIELD_NAMES: Record<SlotName, keyof ProviderDef> = {
  model:      'model',
  opus:       'opus_model',
  sonnet:     'sonnet_model',
  haiku:      'haiku_model',
  subagent:   'subagent_model',
  small_fast: 'small_fast_model',
  strong:     'strong_model',
  fallback:   'fallback_model',
  classifier: 'classifier_model',
  compact:    'compact_model',
}

// ── App-specific LLM config (~/.atta/{app}/settings.json llm section) ──

export interface AppLLMConfig {
  /** Which provider id to use from the shared config. Empty/null = first available. */
  provider?: string
  /** Which API interface to use from the provider's interfaces map. Empty/null = first available. */
  api_type?: ApiType
}

// ── Atta family shared config (~/.atta/settings.json) ──

export interface AttaSharedConfig {
  providers: ProviderDef[]
}

// ── Normalization: legacy api_type + base_url → interfaces map ──

/** Normalize a ProviderDef's interfaces — supports both new (interfaces map) and legacy (api_type + base_url) formats */
export function normalizeInterfaces(def: ProviderDef): { interfaces: Record<string, string>; apiTypes: ApiType[] } {
  // New format: explicit interfaces map
  if (def.interfaces && Object.keys(def.interfaces).length > 0) {
    const entries = Object.entries(def.interfaces) as [string, string][]
    return {
      interfaces: def.interfaces,
      apiTypes: entries.map(([k]) => k as ApiType),
    }
  }
  // Legacy format: api_type + base_url → single-entry interfaces
  if (def.api_type && def.base_url) {
    return {
      interfaces: { [def.api_type]: def.base_url },
      apiTypes: [def.api_type],
    }
  }
  // Degraded: no interfaces at all
  return { interfaces: {}, apiTypes: [] }
}

/** Pick the api_type and base_url based on app config preference, falling back to first available */
export function pickInterface(
  norm: ReturnType<typeof normalizeInterfaces>,
  preferredApiType?: ApiType,
): { apiType: ApiType; baseUrl: string } | null {
  if (norm.apiTypes.length === 0) return null

  // If app specifies api_type and it exists in interfaces, use it
  if (preferredApiType && norm.interfaces[preferredApiType]) {
    return { apiType: preferredApiType, baseUrl: norm.interfaces[preferredApiType] }
  }

  // Otherwise use the first available
  const first = norm.apiTypes[0]
  return { apiType: first, baseUrl: norm.interfaces[first] }
}
