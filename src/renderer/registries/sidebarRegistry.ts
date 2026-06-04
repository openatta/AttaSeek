/**
 * sidebarRegistry — maps sidebar view keys to React components.
 *
 * Each activity or plugin registers its sidebar content here.
 * SidebarSlot resolves the correct SidebarView for the current activity.
 */

import type { ComponentType } from 'react'

export interface SidebarViewRegistration {
  viewKey: string
  activityId: string
  component: ComponentType
  title: string
  pluginId?: string
}

const registry = new Map<string, SidebarViewRegistration>()

export function registerSidebarView(config: SidebarViewRegistration): void {
  const key = `${config.activityId}:${config.viewKey}`
  if (registry.has(key)) {
    console.warn(`[sidebarRegistry] overwriting: ${key}`)
  }
  registry.set(key, config)
}

export function getSidebarView(activityId: string, viewKey: string): SidebarViewRegistration | undefined {
  return registry.get(`${activityId}:${viewKey}`)
}

export function getPrimarySidebarView(activityId: string): SidebarViewRegistration | undefined {
  // Return the first registered sidebar for this activity
  for (const [, reg] of registry) {
    if (reg.activityId === activityId) return reg
  }
  return undefined
}

export function listSidebarViews(activityId?: string): SidebarViewRegistration[] {
  const all = Array.from(registry.values())
  if (activityId) return all.filter((r) => r.activityId === activityId)
  return all
}

export function unregisterByPlugin(pluginId: string): void {
  for (const [key, reg] of registry) {
    if (reg.pluginId === pluginId) {
      registry.delete(key)
    }
  }
}
