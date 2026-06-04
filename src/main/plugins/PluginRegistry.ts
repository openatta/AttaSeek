/**
 * PluginRegistry — centralized registry for plugin manifests.
 * Tracks which plugins are available, their status, and their contributions.
 */

import type { PluginManifest, PluginInstance, PluginStatus } from '../../renderer/core/types/Plugin'

export class PluginRegistry {
  private plugins: Map<string, PluginInstance> = new Map()

  /** Register a plugin manifest */
  register(manifest: PluginManifest): PluginInstance {
    const existing = this.plugins.get(manifest.id)
    if (existing) {
      // Update manifest but keep runtime state
      existing.manifest = manifest
      return existing
    }

    const instance: PluginInstance = {
      manifest,
      status: 'registered',
      errorCount: 0,
      maxErrors: 3,
    }
    this.plugins.set(manifest.id, instance)
    return instance
  }

  /** Activate a plugin */
  activate(pluginId: string): PluginInstance | null {
    const instance = this.plugins.get(pluginId)
    if (!instance) return null

    instance.status = 'loading'
    // In MVP, activation is synchronous (local ts manifests)
    // In future, this would spawn subprocess / MCP server
    instance.status = 'active'
    instance.activatedAt = Date.now()
    return instance
  }

  /** Deactivate a plugin */
  deactivate(pluginId: string): PluginInstance | null {
    const instance = this.plugins.get(pluginId)
    if (!instance) return null
    instance.status = 'inactive'
    return instance
  }

  /** Reload a plugin */
  async reload(pluginId: string): Promise<PluginInstance | null> {
    const instance = this.plugins.get(pluginId)
    if (!instance) return null

    this.deactivate(pluginId)
    // Small delay to let cleanup happen
    await new Promise((r) => setTimeout(r, 100))
    return this.activate(pluginId)
  }

  /** Unload a plugin completely */
  unload(pluginId: string): boolean {
    const instance = this.plugins.get(pluginId)
    if (!instance) return false
    instance.status = 'unloaded'
    this.plugins.delete(pluginId)
    return true
  }

  /** Get a plugin instance */
  get(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId)
  }

  /** Get a plugin manifest */
  getManifest(pluginId: string): PluginManifest | undefined {
    return this.plugins.get(pluginId)?.manifest
  }

  /** List all plugin manifests */
  list(): PluginManifest[] {
    return Array.from(this.plugins.values()).map((i) => i.manifest)
  }

  /** List all plugin instances (internal) */
  listInstances(): PluginInstance[] {
    return Array.from(this.plugins.values())
  }

  /** List only active plugins */
  listActive(): PluginManifest[] {
    return Array.from(this.plugins.values())
      .filter((i) => i.status === 'active')
      .map((i) => i.manifest)
  }

  /** Get aggregate activity entries from all active plugins */
  getActivityEntries(): { pluginId: string; entry: PluginManifest['activityEntries'] }[] {
    return this.listActive()
      .filter((m) => m.activityEntries && m.activityEntries.length > 0)
      .map((m) => ({ pluginId: m.id, entry: m.activityEntries! }))
  }

  /** Handle plugin errors */
  onPluginError(pluginId: string, error: Error): void {
    const instance = this.plugins.get(pluginId)
    if (!instance) return

    instance.error = error.message
    instance.errorCount++
    if (instance.errorCount >= instance.maxErrors) {
      instance.status = 'error'
      console.error(`[PluginRegistry] auto-deactivating ${pluginId}: ${instance.errorCount} errors`)
    }
  }

  get count(): number {
    return this.plugins.size
  }
}

/** Singleton */
export const pluginRegistry = new PluginRegistry()
