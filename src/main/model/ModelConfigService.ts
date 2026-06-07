/**
 * ModelConfigService — CRUD for LLM provider configurations.
 *
 * Storage: JSON text files (no SQLite).
 *   - Shared config: ~/.atta/settings.json (providers[])
 *   - App selection:  ~/.atta/seek/settings.json (llm.provider)
 *
 * All read/write goes through AttaSettingsLoader.
 * ModelConfig is a runtime representation mapped to/from ProviderDef.
 */

import { modelProviderRegistry } from '../agent/llm/ModelProviderRegistry'
import { createProvider } from '../agent/llm/ProviderFactory'
import {
  loadLLMConfig,
  listProviders,
  saveProvider,
  deleteProvider,
  getSelectedProviderId,
  getSelectedApiType,
  readJSON,
  writeJSON,
  appConfigPath,
} from '../agent/llm/AttaSettingsLoader'
import type { ProviderDef } from '../agent/llm/ProviderDef'
import { normalizeInterfaces } from '../agent/llm/ProviderDef'
import * as https from 'https'
import * as http from 'http'
import type { ModelConfig, CreateModelConfig } from '../../shared/types/model'

// ── ProviderDef ↔ ModelConfig mapping ──

/** Get the primary interfaceType + endpointUrl from a provider def for display purposes.
 *  Respects the user's llm.api_type selection from app config when available,
 *  falling back to the first registered interface. */
function primaryInterface(def: ProviderDef): { interfaceType: 'openai_compatible' | 'anthropic'; endpointUrl: string } {
  const norm = normalizeInterfaces(def)
  if (norm.apiTypes.length === 0) {
    // Legacy fallback
    return { interfaceType: def.api_type ?? 'anthropic', endpointUrl: def.base_url ?? '' }
  }
  // Check user's api_type preference first
  const preferred = getSelectedApiType()
  if (preferred && norm.apiTypes.includes(preferred)) {
    return { interfaceType: preferred, endpointUrl: norm.interfaces[preferred] }
  }
  // Fall back to first available interface
  return { interfaceType: norm.apiTypes[0], endpointUrl: norm.interfaces[norm.apiTypes[0]] }
}

function providerToModelConfig(def: ProviderDef, isDefault: boolean): ModelConfig {
  const primary = primaryInterface(def)
  return {
    id: def.id,
    name: def.name,
    interfaceType: primary.interfaceType,
    endpointUrl: primary.endpointUrl,
    models: [
      def.model,
      def.opus_model,
      def.sonnet_model,
      def.haiku_model,
      def.small_fast_model,
      def.subagent_model,
      def.strong_model,
      def.fallback_model,
      def.classifier_model,
      def.compact_model,
    ].filter((m): m is string => !!m),
    defaultModel: def.model,
    extraParams: undefined,
    isDefault,
    createdAt: def.created_at ?? 0,
    updatedAt: def.updated_at ?? 0,
    opusModel: def.opus_model,
    sonnetModel: def.sonnet_model,
    haikuModel: def.haiku_model,
    smallFastModel: def.small_fast_model,
    subagentModel: def.subagent_model,
    strongModel: def.strong_model,
    fallbackModel: def.fallback_model,
    classifierModel: def.classifier_model,
    compactModel: def.compact_model,
    effortLevel: def.effort_level,
    maxTokens: def.max_tokens,
    compactThreshold: def.compact_threshold,
  }
}

function configToProviderDef(config: Partial<ModelConfig> & { id: string; name: string; interfaceType: 'openai_compatible' | 'anthropic'; endpointUrl: string; defaultModel: string }, apiKey: string): ProviderDef {
  // Build interfaces map: merge explicit interfaces with the primary interface
  const interfaces: Record<string, string> = { ...((config as any).interfaces as Record<string, string> || {}) }
  interfaces[config.interfaceType] = config.endpointUrl
  return {
    id: config.id,
    name: config.name,
    interfaces,
    auth_token: apiKey,
    model: config.defaultModel,
    opus_model: config.opusModel,
    sonnet_model: config.sonnetModel,
    haiku_model: config.haikuModel,
    small_fast_model: config.smallFastModel,
    subagent_model: config.subagentModel,
    strong_model: config.strongModel,
    fallback_model: config.fallbackModel,
    classifier_model: config.classifierModel,
    compact_model: config.compactModel,
    effort_level: config.effortLevel,
    max_tokens: config.maxTokens,
    compact_threshold: config.compactThreshold,
  }
}

// ── Test types ──

export interface TestStep {
  step: number
  label: string
  status: 'pending' | 'running' | 'ok' | 'fail'
  detail: string
  latencyMs?: number
  requestInfo?: string
  responseInfo?: string
}

export interface TestResult {
  success: boolean
  latencyMs?: number
  model?: string
  error?: string
  errorCode?: 'network_unreachable' | 'auth_failed' | 'model_not_found' | 'unknown'
  steps: TestStep[]
}

// ── Service ──

export class ModelConfigService {
  /** Load all configs from JSON files and register providers */
  loadAll(): ModelConfig[] {
    const result = loadLLMConfig()
    const allDefs = listProviders()
    const selectedId = getSelectedProviderId() || (allDefs.length > 0 ? allDefs[0].id : null)

    const configs: ModelConfig[] = []

    for (const def of allDefs) {
      const isDefault = def.id === selectedId
      configs.push(providerToModelConfig(def, isDefault))

      // Instantiate and register provider
      const provider = createProvider(
        providerToModelConfig(def, isDefault),
        def.auth_token,
      )
      if (provider) {
        modelProviderRegistry.registerById(def.id, provider, {
          name: def.name,
          interfaceType: primaryInterface(def).interfaceType,
          models: provider.models,
        })
        if (isDefault) {
          modelProviderRegistry.setDefault(def.id)
        }
      }
    }

    // If no providers from files but env-only provider was resolved, register it
    if (allDefs.length === 0 && result.provider) {
      const envDef = result.provider.def
      const config = providerToModelConfig(envDef, true)
      configs.push(config)
      const provider = createProvider(config, envDef.auth_token)
      if (provider) {
        modelProviderRegistry.registerById(envDef.id, provider, {
          name: envDef.name,
          interfaceType: result.provider!.apiType,
          models: provider.models,
        })
        modelProviderRegistry.setDefault(envDef.id)
      }
    }

    if (result.error && configs.length === 0) {
      console.warn(`[ModelConfigService] ${result.error}`)
    }

    console.log(`[ModelConfigService] loaded ${configs.length} model configs (JSON)`)
    return configs
  }

  /** List all configs from shared JSON */
  listAll(): ModelConfig[] {
    const allDefs = listProviders()
    const selectedId = getSelectedProviderId() || (allDefs.length > 0 ? allDefs[0].id : null)
    return allDefs.map(def => providerToModelConfig(def, def.id === selectedId))
  }

  /** Get a single config by ID */
  get(id: string): ModelConfig | null {
    const def = listProviders().find(p => p.id === id)
    if (!def) return null
    const selectedId = getSelectedProviderId()
    return providerToModelConfig(def, def.id === selectedId)
  }

  /** Create a new provider and persist to shared JSON */
  create(params: CreateModelConfig): ModelConfig {
    const allDefs = listProviders()

    // Check uniqueness
    if (allDefs.some(d => d.id === params.name.toLowerCase().replace(/\s+/g, '-'))) {
      throw new Error(`Model config named "${params.name}" already exists`)
    }

    const id = params.name.toLowerCase().replace(/\s+/g, '-')
    const isDefault = allDefs.length === 0

    const def = configToProviderDef(
      {
        id,
        name: params.name,
        interfaceType: params.interfaceType,
        endpointUrl: params.endpointUrl,
        defaultModel: params.defaultModel,
        models: params.models,
        opusModel: params.opusModel,
        sonnetModel: params.sonnetModel,
        haikuModel: params.haikuModel,
        smallFastModel: params.smallFastModel,
        subagentModel: params.subagentModel,
        strongModel: params.strongModel,
        fallbackModel: params.fallbackModel,
        classifierModel: params.classifierModel,
        compactModel: params.compactModel,
        effortLevel: params.effortLevel,
        maxTokens: params.maxTokens,
        compactThreshold: params.compactThreshold,
      },
      params.apiKey,
    )

    saveProvider(def)

    // Register provider
    const config = providerToModelConfig(def, isDefault)
    const provider = createProvider(config, params.apiKey)
    if (provider) {
      modelProviderRegistry.registerById(id, provider, {
        name: config.name,
        interfaceType: config.interfaceType,
        models: config.models,
      })
      if (isDefault) modelProviderRegistry.setDefault(id)
    }

    return providerToModelConfig(def, isDefault)
  }

  /** Update an existing provider */
  update(id: string, patch: Partial<Pick<ModelConfig, 'name' | 'endpointUrl' | 'defaultModel' | 'models' | 'extraParams'>> & { apiKey?: string; interfaceType?: 'openai_compatible' | 'anthropic'; opusModel?: string; sonnetModel?: string; haikuModel?: string; smallFastModel?: string; subagentModel?: string; strongModel?: string; fallbackModel?: string; classifierModel?: string; compactModel?: string; effortLevel?: string; maxTokens?: number; compactThreshold?: number }): ModelConfig | null {
    const allDefs = listProviders()
    const existing = allDefs.find(d => d.id === id)
    if (!existing) return null

    // Unregister old provider
    modelProviderRegistry.unregister(id)

    // Merge and save
    // Handle interfaces: patch.interfaces takes priority (from UI dual-interface form),
    // then fall back to existing, then patch.interfaceType + endpointUrl update
    const existingNorm = normalizeInterfaces(existing)
    const patchInterfaces = (patch as any).interfaces as Record<string, string> | undefined
    const updatedInterfaces: Record<string, string> = patchInterfaces
      ? { ...patchInterfaces }
      : { ...existingNorm.interfaces }
    if (!patchInterfaces) {
      if (patch.interfaceType && patch.endpointUrl) {
        updatedInterfaces[patch.interfaceType] = patch.endpointUrl
      } else if (patch.endpointUrl && existingNorm.apiTypes.length > 0) {
        updatedInterfaces[existingNorm.apiTypes[0]] = patch.endpointUrl
      }
    }
    const merged: ProviderDef = {
      ...existing,
      name: patch.name ?? existing.name,
      interfaces: Object.keys(updatedInterfaces).length > 0 ? updatedInterfaces : undefined,
      api_type: undefined,   // clear legacy fields when using interfaces
      base_url: undefined,
      model: patch.defaultModel ?? existing.model,
      opus_model: patch.opusModel !== undefined ? patch.opusModel : existing.opus_model,
      sonnet_model: patch.sonnetModel !== undefined ? patch.sonnetModel : existing.sonnet_model,
      haiku_model: patch.haikuModel !== undefined ? patch.haikuModel : existing.haiku_model,
      small_fast_model: patch.smallFastModel !== undefined ? patch.smallFastModel : existing.small_fast_model,
      subagent_model: patch.subagentModel !== undefined ? patch.subagentModel : existing.subagent_model,
      strong_model: patch.strongModel !== undefined ? patch.strongModel : existing.strong_model,
      fallback_model: patch.fallbackModel !== undefined ? patch.fallbackModel : existing.fallback_model,
      classifier_model: patch.classifierModel !== undefined ? patch.classifierModel : existing.classifier_model,
      compact_model: patch.compactModel !== undefined ? patch.compactModel : existing.compact_model,
      effort_level: patch.effortLevel !== undefined ? patch.effortLevel : existing.effort_level,
      max_tokens: patch.maxTokens !== undefined ? patch.maxTokens : existing.max_tokens,
      compact_threshold: patch.compactThreshold !== undefined ? patch.compactThreshold : existing.compact_threshold,
      auth_token: patch.apiKey ?? existing.auth_token,
    }

    saveProvider(merged)

    // Re-register
    const selectedId = getSelectedProviderId()
    const config = providerToModelConfig(merged, merged.id === selectedId)
    const provider = createProvider(config, merged.auth_token)
    if (provider) {
      modelProviderRegistry.registerById(id, provider, {
        name: config.name, interfaceType: config.interfaceType, models: config.models,
      })
      if (config.isDefault) modelProviderRegistry.setDefault(id)
    }

    return providerToModelConfig(merged, merged.id === selectedId)
  }

  /** Delete a provider from shared JSON */
  delete(id: string): { success: boolean; needNewDefault: boolean } {
    const wasDefault = getSelectedProviderId() === id

    modelProviderRegistry.unregister(id)
    const ok = deleteProvider(id)

    if (wasDefault && ok) {
      const remaining = listProviders()
      if (remaining.length > 0) {
        this.setDefault(remaining[0].id)
      }
    }

    return { success: ok, needNewDefault: wasDefault && ok }
  }

  /** Set a provider as the active one (writes to app config) */
  setDefault(id: string): boolean {
    const allDefs = listProviders()
    if (!allDefs.some(d => d.id === id)) return false

    const configPath = appConfigPath('seek')
    const appConfig = readJSON<Record<string, unknown>>(configPath) ?? {}
    appConfig.llm = { ...(appConfig.llm as Record<string, unknown> || {}), provider: id }
    writeJSON(configPath, appConfig)
    modelProviderRegistry.setDefault(id)
    return true
  }

  /** Test connectivity */
  async test(id: string): Promise<TestResult> {
    const steps: TestStep[] = []
    const start = performance.now()

    const config = this.get(id)
    if (!config) return { success: false, error: 'Config not found', errorCode: 'unknown', steps }

    // Step 1: Network reachability
    const netResult = await this.checkNetwork(config.endpointUrl)
    steps.push(netResult.step)
    if (!netResult.ok) {
      return { success: false, error: netResult.error, errorCode: 'network_unreachable', steps }
    }

    // Step 2: API key check
    const allDefs = listProviders()
    const def = allDefs.find(d => d.id === id)
    const apiKey = def?.auth_token
    steps.push({
      step: 2, label: 'API Key', status: apiKey ? 'ok' : 'fail',
      detail: apiKey ? 'Key configured' : 'No API key stored',
      requestInfo: apiKey ? 'Key: configured' : undefined,
    })
    if (!apiKey) {
      return { success: false, error: 'No API key configured', errorCode: 'auth_failed', steps }
    }

    // Step 3: API call validation
    const apiResult = await this.doApiCheck(config, apiKey)
    steps.push(apiResult.step)
    const latencyMs = Math.round(performance.now() - start)
    if (apiResult.success) {
      return { success: true, latencyMs, model: config.defaultModel, steps }
    }
    return { success: false, latencyMs, error: apiResult.error, errorCode: apiResult.errorCode, steps }
  }

  /** Check if any provider is configured */
  hasConfigured(): boolean {
    return modelProviderRegistry.hasProviders
  }

  // ── Network helpers (unchanged from SQLite version) ──

  private async checkNetwork(endpointUrl: string): Promise<{ ok: boolean; error?: string; step: TestStep }> {
    const t0 = performance.now()
    try {
      const url = new URL(endpointUrl)
      const isHttps = url.protocol === 'https:'
      const mod = isHttps ? https : http
      const result = await new Promise<{ status: number; ok: boolean }>((resolve, reject) => {
        const req = mod.request({ method: 'HEAD', hostname: url.hostname, port: url.port || (isHttps ? 443 : 80), path: '/', timeout: 5000 }, (res) => {
          resolve({ status: res.statusCode || 0, ok: res.statusCode !== undefined && res.statusCode < 500 })
        })
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
        req.end()
      })
      const latencyMs = Math.round(performance.now() - t0)
      return {
        ok: true,
        step: { step: 1, label: 'Network Reachability', status: 'ok', detail: `Connected to ${url.hostname}:${url.port || (isHttps ? 443 : 80)}`, latencyMs, requestInfo: `HEAD ${url.origin}/`, responseInfo: `HTTP ${result.status}` },
      }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - t0)
      const msg = err.message || String(err)
      return {
        ok: false,
        error: msg.includes('timeout') ? 'Connection timed out (5s)' : `Cannot reach endpoint: ${msg}`,
        step: { step: 1, label: 'Network Reachability', status: 'fail', detail: msg, latencyMs, requestInfo: `HEAD ${endpointUrl}/` },
      }
    }
  }

  private async doApiCheck(config: ModelConfig, apiKey: string): Promise<{ success: boolean; error?: string; errorCode?: TestResult['errorCode']; step: TestStep }> {
    const t0 = performance.now()
    const provider = modelProviderRegistry.getById(config.id)
    if (!provider) {
      return { success: false, error: 'Provider not instantiated', errorCode: 'unknown',
        step: { step: 3, label: 'API Call', status: 'fail', detail: 'Provider not instantiated — re-save the config' } }
    }
    try {
      const valid = await provider.validateKey(apiKey)
      const latencyMs = Math.round(performance.now() - t0)
      return valid
        ? { success: true,
            step: { step: 3, label: 'API Call', status: 'ok', detail: `Model "${config.defaultModel}" responded`, latencyMs, requestInfo: `POST ${config.endpointUrl}/messages (Anthropic) or /chat/completions (OpenAI)`, responseInfo: '200 OK — model accessible' } }
        : { success: false, error: 'API call failed — check API key and model name', errorCode: 'auth_failed',
            step: { step: 3, label: 'API Call', status: 'fail', detail: 'API returned error (key validation failed)', latencyMs, requestInfo: `POST ${config.endpointUrl} (model: ${config.defaultModel})` } }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - t0)
      const msg = err instanceof Error ? err.message : String(err)
      const status = err?.status || ''
      const errBody = err?.error || err?.body || msg
      const detail = `Error: ${status ? status + ' ' : ''}${typeof errBody === 'string' ? errBody.slice(0, 300) : msg.slice(0, 300)}`
      const errorCode: TestResult['errorCode'] =
        String(status).includes('401') || String(status).includes('403') ? 'auth_failed' :
        String(status).includes('404') ? 'model_not_found' : 'unknown'
      return { success: false, error: msg.slice(0, 200) || 'API call failed', errorCode,
        step: { step: 3, label: 'API Call', status: 'fail', detail, latencyMs, requestInfo: `POST ${config.endpointUrl} (model: ${config.defaultModel})`, responseInfo: typeof errBody === 'object' ? JSON.stringify(errBody).slice(0, 300) : String(errBody).slice(0, 300) } }
    }
  }
}

export const modelConfigService = new ModelConfigService()
