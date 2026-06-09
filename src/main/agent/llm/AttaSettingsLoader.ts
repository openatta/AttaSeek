/**
 * AttaSettingsLoader — loads LLM configuration from JSON files and environment variables.
 *
 * Data flow:
 *   1. Read ~/.atta/settings.json  →  AttaSharedConfig.providers[]
 *   2. Read ~/.atta/seek/settings.json  →  AppLLMConfig (provider + api_type selection)
 *   3. If llm.provider is empty/null/unmatched → use providers[0]
 *   4. If llm.api_type is empty/null/unsupported → use first interface in provider.interfaces
 *   5. Normalize legacy api_type+base_url → interfaces map
 *   6. Apply environment variable overrides (ATTA_* → ANTHROPIC_* → OPENAI_*)
 *   7. Resolve all slots through fallback chains → ResolvedProvider
 *
 * No SQLite. No hardcoded defaults. If nothing is configured, return gracefully with error message.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { ProviderDef, ResolvedProvider, SlotName, AttaSharedConfig, AppLLMConfig, ApiType } from './ProviderDef'
import { SLOT_FALLBACK_CHAINS, SLOT_FIELD_NAMES, normalizeInterfaces, pickInterface } from './ProviderDef'
import { resolveEnvOverrides, type EnvOverrides } from './AttaEnvResolver'
import { resolveModelAlias } from './ModelAliases'

// ── Paths ──

function attaHome(): string {
  return process.env.ATTA_HOME || path.join(os.homedir(), '.atta')
}

/** Path helpers exported for use by ModelConfigService */
export function sharedConfigPath(): string {
  return path.join(attaHome(), 'settings.json')
}

export function appConfigPath(app: string): string {
  return path.join(attaHome(), app, 'settings.json')
}

// ── JSON helpers ──

export function readJSON<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf-8')
    // Try raw parse first — standard JSON (most common case, handles URLs safely)
    try {
      return JSON.parse(raw) as T
    } catch {
      // Fall back to comment-stripped parse for JSONC/JSON5 files
      const stripped = raw
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      return JSON.parse(stripped) as T
    }
  } catch (err) {
    console.warn(`[AttaSettingsLoader] failed to read ${filePath}:`, (err as Error).message)
    return null
  }
}

export function writeJSON(filePath: string, data: unknown): void {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  } catch (err) {
    console.error(`[AttaSettingsLoader] failed to write ${filePath}:`, (err as Error).message)
  }
}

// ── App name ──

const APP_NAME = 'seek'

// ── Project-level config (layers 4-5) ──

/** Read project-level LLM overrides from <cwd>/.atta/{app}/settings.json (layer 4)
 *  and <cwd>/.atta/{app}/settings.local.json (layer 5).
 *  Layer 5 overrides layer 4. Both override the shared + app config + env layers.
 *  Returns partial ProviderDef fields to merge on top. */
function readProjectOverrides(): Partial<ProviderDef> | null {
  try {
    const cwd = process.cwd()
    const projectConfigPath = path.join(cwd, '.atta', APP_NAME, 'settings.json')
    const localConfigPath = path.join(cwd, '.atta', APP_NAME, 'settings.local.json')

    let merged: Record<string, unknown> = {}

    // Layer 4: project-level (can be committed)
    const projectCfg = readJSON<Record<string, unknown>>(projectConfigPath)
    if (projectCfg?.llm && typeof projectCfg.llm === 'object') {
      merged = { ...projectCfg.llm as Record<string, unknown> }
    }

    // Layer 5: project local (not committed, overrides layer 4)
    const localCfg = readJSON<Record<string, unknown>>(localConfigPath)
    if (localCfg?.llm && typeof localCfg.llm === 'object') {
      merged = { ...merged, ...localCfg.llm as Record<string, unknown> }
    }

    if (Object.keys(merged).length === 0) return null

    // Map project config keys to ProviderDef field names
    const result: Record<string, unknown> = {}
    if (merged.model) result.model = merged.model
    if (merged.opus_model) result.opus_model = merged.opus_model
    if (merged.sonnet_model) result.sonnet_model = merged.sonnet_model
    if (merged.haiku_model) result.haiku_model = merged.haiku_model
    if (merged.small_fast_model) result.small_fast_model = merged.small_fast_model
    if (merged.subagent_model) result.subagent_model = merged.subagent_model
    if (merged.strong_model) result.strong_model = merged.strong_model
    if (merged.fallback_model) result.fallback_model = merged.fallback_model
    if (merged.classifier_model) result.classifier_model = merged.classifier_model
    if (merged.compact_model) result.compact_model = merged.compact_model
    if (merged.effort_level) result.effort_level = merged.effort_level
    if (merged.max_tokens) result.max_tokens = merged.max_tokens
    if (merged.compact_threshold) result.compact_threshold = merged.compact_threshold
    if (merged.base_url) result.base_url = merged.base_url
    if (merged.auth_token) result.auth_token = merged.auth_token

    return Object.keys(result).length > 0 ? (result as Partial<ProviderDef>) : null
  } catch (err) {
    console.warn('[AttaSettingsLoader] failed to read project configs:', (err as Error).message)
    return null
  }
}

// ── Cache ──

let _cachedResult: LoadResult | null = null
let _cacheTime = 0
const CACHE_TTL_MS = 30_000  // 30 second cache to avoid repeated file I/O

/** Invalidate the config cache (call after writing config files) */
export function invalidateConfigCache(): void {
  _cachedResult = null
  _cacheTime = 0
}

// ── Main loader ──

export interface LoadResult {
  provider: ResolvedProvider | null
  error?: string
  allProviders: ProviderDef[]
  selectedProviderId: string | null
  selectedApiType: ApiType | null
}

/**
 * Load the full LLM configuration:
 *  1. Read shared config (~/.atta/settings.json)
 *  2. Read app config (~/.atta/seek/settings.json) for provider + api_type choice
 *  3. Select provider & resolve interface
 *  4. Apply environment overrides
 *  5. Resolve all slots
 */
/**
 * Load the full LLM configuration.
 * @param preferredProviderId Optional override — if provided, use this provider instead of app config's selection.
 *   Used when a specific task requests a non-default provider (e.g., via modelConfigId).
 */
export function loadLLMConfig(preferredProviderId?: string): LoadResult {
  // Use cache if no specific provider override and cache is fresh
  if (!preferredProviderId && _cachedResult && (Date.now() - _cacheTime) < CACHE_TTL_MS) {
    return _cachedResult
  }

  // 1. Load shared config
  const shared = readJSON<AttaSharedConfig>(sharedConfigPath())
  const providers = shared?.providers ?? []

  // 2. Load app config
  const appConfig = readJSON<Record<string, unknown>>(appConfigPath(APP_NAME))
  const llmSection = (appConfig?.llm as AppLLMConfig | undefined)
  // preferredProviderId takes precedence over app config (e.g., task-specific model selection)
  const selectedProviderId = preferredProviderId ?? llmSection?.provider ?? null
  const selectedApiType = llmSection?.api_type ?? null

  // 3. Environment overrides
  const envOverrides = resolveEnvOverrides()

  // 4. Select provider
  let providerDef: ProviderDef | null = null
  let resolvedApiType: ApiType | null = null
  let resolvedBaseUrl: string | null = null

  if (selectedProviderId) {
    providerDef = providers.find(p => p.id === selectedProviderId) ?? null
    if (!providerDef && providers.length > 0) {
      console.warn(`[AttaSettingsLoader] provider "${selectedProviderId}" not found, falling back to first available`)
      providerDef = providers[0]
    }
  } else if (providers.length > 0) {
    providerDef = providers[0]
  }

  // 5. Resolve interface from provider's interfaces map
  if (providerDef) {
    const norm = normalizeInterfaces(providerDef)
    const picked = pickInterface(norm, selectedApiType ?? undefined)
    if (picked) {
      resolvedApiType = picked.apiType
      resolvedBaseUrl = picked.baseUrl
    }
  }

  // 6. If no provider from file, try env-only construction
  if (!providerDef) {
    if (envOverrides.authToken && envOverrides.model) {
      providerDef = buildEnvProvider(envOverrides)
      resolvedApiType = 'anthropic'
      resolvedBaseUrl = envOverrides.baseUrl ?? 'https://api.anthropic.com'
    }
  }

  if (!providerDef || !resolvedApiType || !resolvedBaseUrl) {
    return {
      provider: null,
      error: 'No LLM provider configured. Set up ~/.atta/settings.json with at least one provider, or set ATTA_AUTH_TOKEN + ATTA_MODEL environment variables.',
      allProviders: providers,
      selectedProviderId,
      selectedApiType,
    }
  }

  // 7. Apply env overrides to the selected provider
  providerDef = applyEnvOverrides(providerDef, envOverrides)
  // Env can also override base_url
  if (envOverrides.baseUrl) resolvedBaseUrl = envOverrides.baseUrl

  // 7b. Apply project-level configs (layers 4-5: <cwd>/.atta/seek/settings.json + settings.local.json)
  const projectOverrides = readProjectOverrides()
  if (projectOverrides) {
    providerDef = { ...providerDef, ...projectOverrides }
    if (projectOverrides.base_url) resolvedBaseUrl = projectOverrides.base_url
  }

  // 8. Auto-persist if the selection was missing, stale, or needed fallback correction
  const needsPersist = !llmSection?.provider || !llmSection?.api_type
    || llmSection.provider !== providerDef.id
    || llmSection.api_type !== resolvedApiType
  if (needsPersist) {
    persistAppSelection(providerDef.id, resolvedApiType)
  }

  // 9. Resolve all slots through fallback chains
  const resolved = resolveSlots(providerDef, resolvedApiType, resolvedBaseUrl, envOverrides)

  const result: LoadResult = {
    provider: resolved,
    allProviders: providers,
    selectedProviderId: providerDef.id,
    selectedApiType: resolvedApiType,
  }

  // Cache when loading default config (no specific provider override)
  if (!preferredProviderId) {
    _cachedResult = result
    _cacheTime = Date.now()
  }

  return result
}

// ── Slot resolution ──

function resolveSlots(def: ProviderDef, apiType: ApiType, baseUrl: string, env: EnvOverrides): ResolvedProvider {
  const resolved = {} as Record<string, string>

  for (const [slotName, chain] of Object.entries(SLOT_FALLBACK_CHAINS) as [SlotName, SlotName[]][]) {
    let value: string | undefined
    for (const step of chain) {
      const envKey = slotEnvKey(step)
      if (envKey && (env as Record<string, string | undefined>)[envKey]) {
        value = (env as Record<string, string | undefined>)[envKey]
        break
      }
      const fieldName = SLOT_FIELD_NAMES[step]
      const fieldVal = def[fieldName]
      if (typeof fieldVal === 'string' && fieldVal) {
        value = fieldVal
        break
      }
    }
    // Resolve aliases (e.g., 'sonnet' → 'claude-sonnet-4-6')
    const raw = value ?? def.model
    resolved[slotName] = resolveModelAlias(raw)
  }

  return {
    def,
    apiType,
    baseUrl,
    authToken: env.authToken ?? def.auth_token,
    model: resolved.model,
    opus: resolved.opus,
    sonnet: resolved.sonnet,
    haiku: resolved.haiku,
    subagent: resolved.subagent,
    smallFast: resolved.small_fast,
    strong: resolved.strong,
    fallback: resolved.fallback,
    classifier: resolved.classifier,
    compact: resolved.compact,
    effortLevel: env.effortLevel ?? def.effort_level,
    maxTokens: env.maxTokens ?? def.max_tokens,
    compactThreshold: env.compactThreshold ?? def.compact_threshold,
  }
}

function slotEnvKey(slot: SlotName): string | undefined {
  switch (slot) {
    case 'model': return 'model'
    case 'opus': return 'opusModel'
    case 'sonnet': return 'sonnetModel'
    case 'haiku': return 'haikuModel'
    case 'subagent': return 'subagentModel'
    case 'small_fast': return 'smallFastModel'
    case 'strong': return 'strongModel'
    case 'fallback': return 'fallbackModel'
    case 'classifier': return 'classifierModel'
    case 'compact': return 'compactModel'
  }
}

// ── Env override application ──

function applyEnvOverrides(def: ProviderDef, env: EnvOverrides): ProviderDef {
  return {
    ...def,
    auth_token: env.authToken ?? def.auth_token,
    model: env.model ?? def.model,
    opus_model: env.opusModel ?? def.opus_model,
    sonnet_model: env.sonnetModel ?? def.sonnet_model,
    haiku_model: env.haikuModel ?? def.haiku_model,
    small_fast_model: env.smallFastModel ?? def.small_fast_model,
    subagent_model: env.subagentModel ?? def.subagent_model,
    strong_model: env.strongModel ?? def.strong_model,
    fallback_model: env.fallbackModel ?? def.fallback_model,
    classifier_model: env.classifierModel ?? def.classifier_model,
    compact_model: env.compactModel ?? def.compact_model,
    effort_level: env.effortLevel ?? def.effort_level,
    max_tokens: env.maxTokens ?? def.max_tokens,
    compact_threshold: env.compactThreshold ?? def.compact_threshold,
  }
}

function buildEnvProvider(env: EnvOverrides): ProviderDef {
  return {
    id: 'env',
    name: 'Environment',
    interfaces: { anthropic: env.baseUrl ?? 'https://api.anthropic.com' },
    auth_token: env.authToken ?? '',
    model: env.model ?? '',
    opus_model: env.opusModel,
    sonnet_model: env.sonnetModel,
    haiku_model: env.haikuModel,
    small_fast_model: env.smallFastModel,
    subagent_model: env.subagentModel,
    strong_model: env.strongModel,
    fallback_model: env.fallbackModel,
    classifier_model: env.classifierModel,
    compact_model: env.compactModel,
    effort_level: env.effortLevel,
    max_tokens: env.maxTokens,
    compact_threshold: env.compactThreshold,
  }
}

// ── Persistence ──

/** Persist selected provider id + api_type into ~/.atta/seek/settings.json */
function persistAppSelection(providerId: string, apiType: ApiType): void {
  try {
    const filePath = appConfigPath(APP_NAME)
    let config: Record<string, unknown> = {}
    if (fs.existsSync(filePath)) {
      config = readJSON<Record<string, unknown>>(filePath) ?? {}
    }
    config.llm = { ...(config.llm as Record<string, unknown> || {}), provider: providerId, api_type: apiType }
    writeJSON(filePath, config)
    console.log(`[AttaSettingsLoader] persisted llm.provider="${providerId}" api_type="${apiType}" to ${filePath}`)
  } catch (err) {
    console.warn('[AttaSettingsLoader] failed to persist app selection:', (err as Error).message)
  }
}

// ── Provider management (CRUD for UI) ──

export function listProviders(): ProviderDef[] {
  const shared = readJSON<AttaSharedConfig>(sharedConfigPath())
  return shared?.providers ?? []
}

export function saveProvider(def: ProviderDef): void {
  const filePath = sharedConfigPath()
  const shared = readJSON<AttaSharedConfig>(filePath) ?? { providers: [] }
  const idx = shared.providers.findIndex(p => p.id === def.id)
  const now = Date.now()
  if (idx >= 0) {
    // Preserve original created_at, update updated_at
    def.updated_at = now
    if (!def.created_at && shared.providers[idx].created_at) {
      def.created_at = shared.providers[idx].created_at
    }
    shared.providers[idx] = def
  } else {
    // First save: set both timestamps
    def.created_at = def.created_at ?? now
    def.updated_at = now
    shared.providers.push(def)
  }
  writeJSON(filePath, shared)
  invalidateConfigCache()
}

export function deleteProvider(id: string): boolean {
  const filePath = sharedConfigPath()
  const shared = readJSON<AttaSharedConfig>(filePath)
  if (!shared) return false
  const idx = shared.providers.findIndex(p => p.id === id)
  if (idx < 0) return false
  shared.providers.splice(idx, 1)
  writeJSON(filePath, shared)
  invalidateConfigCache()
  return true
}

export function getSelectedProviderId(): string | null {
  const appConfig = readJSON<Record<string, unknown>>(appConfigPath(APP_NAME))
  const llmSection = (appConfig?.llm as AppLLMConfig | undefined)
  return llmSection?.provider ?? null
}

export function getSelectedApiType(): ApiType | null {
  const appConfig = readJSON<Record<string, unknown>>(appConfigPath(APP_NAME))
  const llmSection = (appConfig?.llm as AppLLMConfig | undefined)
  return llmSection?.api_type ?? null
}
