/**
 * sidebarRegistry — maps sidebar view keys to React components.
 *
 * Each activity or plugin registers its sidebar content here.
 * SidebarSlot resolves the correct SidebarView for the current activity.
 */

import type { ComponentType } from 'react'
import { Registry } from './Registry'

export interface SidebarViewRegistration {
  viewKey: string
  activityId: string
  component: ComponentType
  title: string
  pluginId?: string
}

const registry = new Registry<SidebarViewRegistration>()

export function registerSidebarView(config: SidebarViewRegistration): void {
  registry.register(`${config.activityId}:${config.viewKey}`, config)
}

export function getSidebarView(activityId: string, viewKey: string): SidebarViewRegistration | undefined {
  return registry.get(`${activityId}:${viewKey}`)
}

export function getPrimarySidebarView(activityId: string): SidebarViewRegistration | undefined {
  // Return the first registered sidebar for this activity
  for (const [, reg] of registry.entries()) {
    if (reg.activityId === activityId) return reg
  }
  return undefined
}

export function listSidebarViews(activityId?: string): SidebarViewRegistration[] {
  if (activityId) return registry.list((r) => r.activityId === activityId)
  return registry.list()
}

export function unregisterByPlugin(pluginId: string): void {
  registry.unregisterByPlugin(pluginId)
}
