/**
 * LLMProviderRegistry — typed provider registry.
 *
 * Holds all configured LLM providers, manages default selection,
 * and provides metadata for the renderer's model settings UI.
 */

import type { LLMProvider } from './LLMProvider'

export interface ProviderInfo {
  id: string
  name: string
  interfaceType: 'openai_compatible' | 'anthropic'
  models: string[]
  isDefault: boolean
}

export class LLMProviderRegistry {
  private providers = new Map<string, LLMProvider>()
  private infos = new Map<string, ProviderInfo>()
  private defaultId: string | null = null

  /** Register a provider by config ID */
  registerById(id: string, provider: LLMProvider, info: Omit<ProviderInfo, 'id' | 'isDefault'>): void {
    this.providers.set(id, provider)
    this.infos.set(id, { ...info, id, isDefault: false })
    if (!this.defaultId) {
      this.defaultId = id
      this.infos.get(id)!.isDefault = true
    }
  }

  /** Get a provider by config ID */
  getById(id: string): LLMProvider | undefined {
    return this.providers.get(id)
  }

  /** Get the default provider */
  getDefault(): LLMProvider | undefined {
    return this.defaultId ? this.providers.get(this.defaultId) : undefined
  }

  /** Get default provider ID */
  getDefaultId(): string | null {
    return this.defaultId
  }

  /** Set a provider as default */
  setDefault(id: string): boolean {
    if (!this.providers.has(id)) return false
    if (this.defaultId) {
      const old = this.infos.get(this.defaultId)
      if (old) old.isDefault = false
    }
    this.defaultId = id
    const info = this.infos.get(id)
    if (info) info.isDefault = true
    return true
  }

  /** Unregister a provider */
  unregister(id: string): boolean {
    const deleted = this.providers.delete(id)
    this.infos.delete(id)
    if (this.defaultId === id) {
      const next = this.providers.keys().next().value
      this.defaultId = next || null
      if (this.defaultId) {
        const info = this.infos.get(this.defaultId)
        if (info) info.isDefault = true
      }
    }
    return deleted
  }

  /** List all provider metadata */
  listProviders(): ProviderInfo[] {
    return Array.from(this.infos.values())
  }

  /** Check if any provider is configured */
  get hasProviders(): boolean {
    return this.providers.size > 0
  }
}

/** Singleton */
export const llmProviderRegistry = new LLMProviderRegistry()
