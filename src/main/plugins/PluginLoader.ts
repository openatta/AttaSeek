/**
 * PluginLoader — boot sequence and lifecycle orchestration for plugins.
 *
 * Two loading paths:
 *   1. Built-in packs: synchronous TypeScript manifest factories (MVP path).
 *   2. Marketplace plugins: isolated child_process.fork() via PluginHostManager.
 *      Each marketplace plugin runs in its own V8 isolate, preventing crashes
 *      from propagating to the main process.
 */

import type { PluginManifest } from '../../shared/types/Plugin'
import { pluginRegistry } from './PluginRegistry'
import { skillRegistry } from '../skills/SkillRegistry'
import { toolRegistry } from '../tools/ToolRegistry'
import { pluginHostManager } from './PluginHostManager'

export interface BootResult {
  loaded: string[]
  failed: { id: string; error: string }[]
  isolated: string[]  // plugins loaded in subprocess isolation
}

export interface MarketplacePluginDef {
  manifest: PluginManifest
  pluginDir: string
}

export class PluginLoader {
  private builtInPacks: (() => PluginManifest)[] = []
  private marketplacePlugins: MarketplacePluginDef[] = []

  /** Register a built-in pack factory (called before boot) */
  registerPack(factory: () => PluginManifest): void {
    this.builtInPacks.push(factory)
  }

  /** Register a marketplace plugin to be loaded in isolation */
  registerMarketplacePlugin(def: MarketplacePluginDef): void {
    this.marketplacePlugins.push(def)
  }

  /** Boot sequence: built-in packs synchronously, marketplace plugins isolated. */
  async boot(): Promise<BootResult> {
    const result: BootResult = { loaded: [], failed: [], isolated: [] }

    // Phase 1: Built-in packs (synchronous, in-process)
    for (const factory of this.builtInPacks) {
      let manifest: PluginManifest
      try {
        manifest = factory()
      } catch (err) {
        result.failed.push({
          id: 'unknown',
          error: err instanceof Error ? err.message : 'Manifest factory threw',
        })
        continue
      }

      try {
        pluginRegistry.register(manifest)
        pluginRegistry.activate(manifest.id)
        result.loaded.push(manifest.id)
        console.log(`[PluginLoader] activated (builtin): ${manifest.id} v${manifest.version}`)
      } catch (err) {
        pluginRegistry.onPluginError(
          manifest.id,
          err instanceof Error ? err : new Error('Activation failed'),
        )
        result.failed.push({ id: manifest.id, error: String(err) })
      }
    }

    // Phase 2: Marketplace plugins (isolated child processes)
    // Spawn in parallel for faster startup — each spawn is IO-bound
    if (this.marketplacePlugins.length > 0) {
      const spawnResults = await Promise.allSettled(
        this.marketplacePlugins.map(async (def) => {
          const manifestPath = `${def.pluginDir}/plugin.json`

          // Register the manifest first (so pluginRegistry knows about it)
          pluginRegistry.register(def.manifest)

          // Spawn the isolated process
          const contributions = await pluginHostManager.spawnPlugin({
            pluginId: def.manifest.id,
            manifestPath,
            pluginDir: def.pluginDir,
          })

          if (contributions) {
            console.log(`[PluginLoader] activated (isolated): ${def.manifest.id} v${def.manifest.version}`)
          }

          return { id: def.manifest.id, success: contributions !== null }
        }),
      )

      for (const r of spawnResults) {
        if (r.status === 'fulfilled') {
          if (r.value.success) {
            result.isolated.push(r.value.id)
          } else {
            result.failed.push({ id: r.value.id, error: 'Plugin process failed to start' })
          }
        } else {
          result.failed.push({ id: 'unknown', error: r.reason?.message || 'Spawn failed' })
        }
      }
    }

    console.log(
      `[PluginLoader] boot complete: ${result.loaded.length} builtin, ` +
      `${result.isolated.length} isolated, ${result.failed.length} failed`,
    )
    return result
  }

  /** Deactivate a single plugin — handles both builtin and isolated. */
  async deactivate(pluginId: string): Promise<boolean> {
    // Check if it's an isolated plugin
    if (pluginHostManager.getState().running > 0) {
      try {
        await pluginHostManager.deactivatePlugin(pluginId)
        // Unregister contributions (tools/skills already removed by PluginHostManager)
        const instance = pluginRegistry.get(pluginId)
        if (instance) {
          pluginRegistry.deactivate(pluginId)
        }
        console.log(`[PluginLoader] deactivated (isolated): ${pluginId}`)
        return true
      } catch {
        // Fall through to builtin path
      }
    }

    // Built-in plugin deactivation
    const instance = pluginRegistry.deactivate(pluginId)
    if (!instance) return false
    skillRegistry.unregisterByPlugin(pluginId)
    toolRegistry.unregisterByPlugin(pluginId)
    console.log(`[PluginLoader] deactivated: ${pluginId}`)
    return true
  }

  /** Hot-reload an isolated plugin (deactivate → respawn). */
  async reload(pluginId: string): Promise<boolean> {
    // Only supported for isolated plugins
    const def = this.marketplacePlugins.find(p => p.manifest.id === pluginId)
    if (!def) {
      // Fall back to built-in reload path
      if (!this.deactivate(pluginId)) return false
      const result = await pluginRegistry.reload(pluginId)
      return result?.status === 'active'
    }

    // Isolated reload: deactivate, respawn
    await this.deactivate(pluginId)

    const manifestPath = `${def.pluginDir}/plugin.json`
    const contributions = await pluginHostManager.spawnPlugin({
      pluginId: def.manifest.id,
      manifestPath,
      pluginDir: def.pluginDir,
    })

    return contributions !== null
  }

  /** Shut down all isolated plugin processes (call on app quit). */
  async shutdown(): Promise<void> {
    await pluginHostManager.shutdownAll()
  }
}

/** Singleton */
export const pluginLoader = new PluginLoader()
