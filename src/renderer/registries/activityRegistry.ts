/**
 * activityRegistry — maps Activity IDs to their layout configuration.
 *
 * Activities are platform-level navigation targets. Each activity specifies:
 * - sidebarView: component rendered in SidebarSlot
 * - defaultLayoutMode: Standard / ArtifactFocus / Review / ChatOnly
 * - defaultArtifactTabs: ArtifactPane tabs shown by default
 *
 * Plugins contribute activities via registerActivity().
 */

import type { ComponentType } from 'react'

export type LayoutMode = 'standard' | 'artifactFocus' | 'review' | 'chatOnly'

export interface ActivityRegistration {
  activity: string
  sidebarView?: ComponentType
  defaultLayoutMode: LayoutMode
  defaultArtifactTabs: string[]
  pluginId?: string // undefined = built-in
}

const registry = new Map<string, ActivityRegistration>()

export function registerActivity(config: ActivityRegistration): void {
  if (registry.has(config.activity)) {
    console.warn(`[activityRegistry] overwriting activity: ${config.activity}`)
  }
  registry.set(config.activity, config)
}

export function getActivityConfig(activity: string): ActivityRegistration | undefined {
  return registry.get(activity)
}

export function listActivities(): ActivityRegistration[] {
  return Array.from(registry.values())
}

export function listBuiltInActivities(): ActivityRegistration[] {
  return Array.from(registry.values()).filter((a) => !a.pluginId)
}

export function unregisterByPlugin(pluginId: string): void {
  for (const [key, config] of registry) {
    if (config.pluginId === pluginId) {
      registry.delete(key)
    }
  }
}
