/**
 * activityRegistry — maps Activity IDs to their layout configuration.
 *
 * Activities are platform-level navigation targets. Each activity specifies:
 * - sidebarView: component rendered in SidebarSlot
 * - workspaceComponent: main content component
 * - defaultArtifactTabs: ArtifactPane tabs shown by default
 *
 * Plugins contribute activities via registerActivity().
 */

import type { ComponentType } from 'react'
import { Registry } from './Registry'

export interface ActivityRegistration {
  activity: string
  sidebarView?: ComponentType
  workspaceComponent?: ComponentType  // main content rendered by WorkspaceRouter
  defaultArtifactTabs: string[]
  pluginId?: string // undefined = built-in
}

const registry = new Registry<ActivityRegistration>()

export function registerActivity(config: ActivityRegistration): void {
  registry.register(config.activity, config)
}

export function getActivityConfig(activity: string): ActivityRegistration | undefined {
  return registry.get(activity)
}

export function listActivities(): ActivityRegistration[] {
  return registry.list()
}

export function listBuiltInActivities(): ActivityRegistration[] {
  return registry.list((a) => !a.pluginId)
}

export function unregisterByPlugin(pluginId: string): void {
  registry.unregisterByPlugin(pluginId)
}
