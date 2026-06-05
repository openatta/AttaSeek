/**
 * PluginLoader — boot sequence and lifecycle orchestration for plugins.
 *
 * MVP: manages built-in TypeScript manifest packs. Each pack is a factory
 * function that returns a PluginManifest. The loader registers packs via
 * PluginRegistry, then activates them in sequence.
 */

import type { PluginManifest } from '../../shared/types/Plugin'
import { pluginRegistry } from './PluginRegistry'
import { skillRegistry } from '../skills/SkillRegistry'
import { toolRegistry } from '../tools/ToolRegistry'

export interface BootResult {
  loaded: string[]
  failed: { id: string; error: string }[]
}

export class PluginLoader {
  private builtInPacks: (() => PluginManifest)[] = []

  /** Register a built-in pack factory (called before boot) */
  registerPack(factory: () => PluginManifest): void {
    this.builtInPacks.push(factory)
  }

  /** Boot sequence: register all packs, activate each, handle errors */
  boot(): BootResult {
    const result: BootResult = { loaded: [], failed: [] }

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
        console.log(`[PluginLoader] activated: ${manifest.id} v${manifest.version}`)
      } catch (err) {
        pluginRegistry.onPluginError(
          manifest.id,
          err instanceof Error ? err : new Error('Activation failed'),
        )
        result.failed.push({ id: manifest.id, error: String(err) })
      }
    }

    console.log(`[PluginLoader] boot complete: ${result.loaded.length} loaded, ${result.failed.length} failed`)
    return result
  }

  /** Deactivate a single plugin */
  deactivate(pluginId: string): boolean {
    const instance = pluginRegistry.deactivate(pluginId)
    if (!instance) return false
    // Unregister plugin contributions
    skillRegistry.unregisterByPlugin(pluginId)
    toolRegistry.unregisterByPlugin(pluginId)
    console.log(`[PluginLoader] deactivated: ${pluginId}`)
    return true
  }

  /** Hot-reload a plugin (deactivate → activate). PluginRegistry.reload handles status flip. */
  async reload(pluginId: string): Promise<boolean> {
    // Deactivate cleans up skills/tools; PluginRegistry.reload() handles status transition
    if (!this.deactivate(pluginId)) return false
    const result = await pluginRegistry.reload(pluginId)
    return result?.status === 'active'
  }
}

/** Singleton */
export const pluginLoader = new PluginLoader()
