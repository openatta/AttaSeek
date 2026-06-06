/**
 * ModelConfigService — CRUD for LLM provider configurations.
 * Loads all configs from SQLite at boot, instantiates providers, registers them.
 */

import { getDb, dbQuery, dbQueryOne } from '../store/db'
import { newId } from '../store/id'
import { storeApiKey, getApiKey, deleteApiKey } from '../store/secrets'
import { llmProviderRegistry } from '../agent/llm/LLMProviderRegistry'
import { createProvider } from '../agent/llm/ProviderFactory'
import * as https from 'https'
import * as http from 'http'
import type { ModelConfig, CreateModelConfig } from '../../shared/types/model'

function keyId(configId: string): string {
  return `model:${configId}`
}

const DEFAULT_ANTHROPIC_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-8']

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

export class ModelConfigService {
  /** Load all configs from DB and register providers */
  loadAll(): ModelConfig[] {
    const rows = dbQuery<Record<string, unknown>>('SELECT * FROM model_configs ORDER BY is_default DESC, created_at ASC')
    const configs: ModelConfig[] = []

    for (const row of rows) {
      const config = this.rowToConfig(row)
      configs.push(config)

      // Instantiate provider
      const apiKey = getApiKey(keyId(row.id as string))
      if (apiKey) {
        const provider = createProvider(config, apiKey)
        if (provider) {
          llmProviderRegistry.registerById(config.id, provider, {
            name: config.name,
            interfaceType: config.interfaceType,
            models: provider.models,
          })
          if (config.isDefault) {
            llmProviderRegistry.setDefault(config.id)
          }
        }
      }
    }

    console.log(`[ModelConfigService] loaded ${configs.length} model configs`)
    return configs
  }

  /** List all configs (without keys) */
  listAll(): ModelConfig[] {
    const rows = dbQuery<Record<string, unknown>>('SELECT * FROM model_configs ORDER BY is_default DESC, created_at ASC')
    return rows.map((r) => this.rowToConfig(r))
  }

  /** Get a single config by ID */
  get(id: string): ModelConfig | null {
    const row = dbQueryOne<Record<string, unknown>>('SELECT * FROM model_configs WHERE id = ?', id)
    return row ? this.rowToConfig(row) : null
  }

  /** Create a new model config */
  create(params: CreateModelConfig): ModelConfig {
    const db = getDb()
    const id = `mc_${newId()}`
    const now = Date.now()

    // Check uniqueness
    const existing = db.prepare('SELECT id FROM model_configs WHERE name = ?').get(params.name)
    if (existing) throw new Error(`Model config named "${params.name}" already exists`)

    // Default models per interface type
    const models = params.models.length > 0 ? params.models
      : params.interfaceType === 'anthropic'
        ? DEFAULT_ANTHROPIC_MODELS
        : [params.defaultModel]
    const defaultModel = params.defaultModel || models[0]

    const isDefault = llmProviderRegistry.listProviders().length === 0 ? 1 : 0

    db.prepare(`INSERT INTO model_configs (id, name, interface_type, endpoint_url, models, default_model, extra_params, is_default, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      id, params.name, params.interfaceType, params.endpointUrl,
      JSON.stringify(models), defaultModel,
      params.extraParams ? JSON.stringify(params.extraParams) : null,
      isDefault, now, now,
    )

    // Store API key
    storeApiKey(keyId(id), params.apiKey)

    // Instantiate and register provider
    const config: ModelConfig = { id, name: params.name, interfaceType: params.interfaceType, endpointUrl: params.endpointUrl, models, defaultModel, extraParams: params.extraParams, isDefault: isDefault === 1, createdAt: now, updatedAt: now }
    const provider = createProvider(config, params.apiKey)
    if (provider) {
      llmProviderRegistry.registerById(id, provider, {
        name: config.name,
        interfaceType: config.interfaceType,
        models,
      })
      if (config.isDefault) llmProviderRegistry.setDefault(id)
    }

    return config
  }

  /** Get default models for an interface type */
  static defaultModels(interfaceType: string): string[] {
    if (interfaceType === 'anthropic') {
      return DEFAULT_ANTHROPIC_MODELS
    }
    return []
  }

  /** Update an existing config */
  update(id: string, patch: Partial<Pick<ModelConfig, 'name' | 'endpointUrl' | 'defaultModel' | 'models' | 'extraParams'>> & { apiKey?: string; interfaceType?: 'openai_compatible' | 'anthropic' }): ModelConfig | null {
    const db = getDb()
    const row = dbQueryOne<Record<string, unknown>>('SELECT * FROM model_configs WHERE id = ?', id)
    if (!row) return null

    const now = Date.now()
    const name = patch.name ?? row.name
    const itype = patch.interfaceType ?? row.interface_type
    const endpoint = patch.endpointUrl ?? row.endpoint_url
    const model = patch.defaultModel ?? row.default_model
    const models = patch.models ? JSON.stringify(patch.models) : row.models
    const extra = patch.extraParams !== undefined ? JSON.stringify(patch.extraParams) : row.extra_params

    db.prepare(`UPDATE model_configs SET name=?, interface_type=?, endpoint_url=?, models=?, default_model=?, extra_params=?, updated_at=? WHERE id=?`).run(
      name, itype, endpoint, models, model, extra, now, id,
    )

    // Update API key if provided
    if (patch.apiKey) {
      storeApiKey(keyId(id), patch.apiKey)
    }

    // Unregister old provider (DB has already been updated above)
    llmProviderRegistry.unregister(id)

    // Re-register provider with updated config if API key is available
    const apiKey = getApiKey(keyId(id))
    if (apiKey) {
      const config = this.rowToConfig({ ...row, name, interface_type: itype, endpoint_url: endpoint, models, default_model: model, extra_params: extra, updated_at: now })
      const provider = createProvider(config, apiKey)
      if (provider) {
        llmProviderRegistry.registerById(id, provider, {
          name: config.name, interfaceType: config.interfaceType, models: config.models,
        })
        if (row.is_default) llmProviderRegistry.setDefault(id)
      }
    }

    return this.get(id)
  }

  /** Delete a config */
  delete(id: string): { success: boolean; needNewDefault: boolean } {
    const db = getDb()
    const row = dbQueryOne<Record<string, unknown>>('SELECT is_default FROM model_configs WHERE id = ?', id)
    if (!row) return { success: false, needNewDefault: false }

    const wasDefault = row.is_default === 1

    // Unregister provider
    llmProviderRegistry.unregister(id)

    // Delete API key
    deleteApiKey(keyId(id))

    // Delete from DB
    db.prepare('DELETE FROM model_configs WHERE id = ?').run(id)

    // Auto-promote next if was default
    if (wasDefault && llmProviderRegistry.listProviders().length > 0) {
      const next = llmProviderRegistry.listProviders()[0]
      this.setDefault(next.id)
    }

    return { success: true, needNewDefault: wasDefault }
  }

  /** Set a config as default */
  setDefault(id: string): boolean {
    const db = getDb()
    const row = dbQueryOne<Record<string, unknown>>('SELECT id FROM model_configs WHERE id = ?', id)
    if (!row) return false

    const now = Date.now()
    db.prepare('UPDATE model_configs SET is_default = 0').run()
    db.prepare('UPDATE model_configs SET is_default = 1, updated_at = ? WHERE id = ?').run(now, id)
    llmProviderRegistry.setDefault(id)
    return true
  }

  /** Test connectivity — three-step diagnostic with detailed step info */
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
    const apiKey = getApiKey(keyId(id))
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
    const provider = llmProviderRegistry.getById(config.id)
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

  /** Check if any provider is configured (for renderer no-config check) */
  hasConfigured(): boolean {
    return llmProviderRegistry.hasProviders
  }

  // ── Helpers ──

  private rowToConfig(r: any): ModelConfig {
    return {
      id: r.id,
      name: r.name,
      interfaceType: r.interface_type as ModelConfig['interfaceType'],
      endpointUrl: r.endpoint_url,
      models: r.models ? JSON.parse(r.models) : [],
      defaultModel: r.default_model,
      extraParams: r.extra_params ? JSON.parse(r.extra_params) : undefined,
      isDefault: r.is_default === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

}

export const modelConfigService = new ModelConfigService()
