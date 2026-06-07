/**
 * Plugin system types — re-exports from shared/types/Plugin + plugin-specific additions.
 *
 * Canonical source for PluginManifest, PluginInstance, PluginStatus:
 *   → shared/types/Plugin.ts
 *
 * This file adds:
 *   - PluginContributions (resolved at load time, used by PluginLoader)
 *   - PluginLoader interface (main-process side)
 */

// Re-export canonical types
export type {
  PluginManifest,
  PluginInstance,
  PluginStatus,
  PluginMarketplace,
  PluginListing,
} from '../../shared/types/Plugin'

/** Plugin contributions — resolved paths from plugin.json */
export interface PluginContributions {
  tools?: string[]
  skills?: string[]
  hooks?: string[]
  mcpServers?: string[]
  agents?: string[]
  renderers?: string[]
  activities?: string[]
  sidebars?: string[]
}

/** Plugin loader interface */
export interface PluginLoaderInterface {
  discover(searchPaths: string[]): Promise<import('../../shared/types/Plugin').PluginManifest[]>
  load(manifest: import('../../shared/types/Plugin').PluginManifest): Promise<import('../../shared/types/Plugin').PluginInstance>
  validate(manifest: import('../../shared/types/Plugin').PluginManifest): string | null
}
