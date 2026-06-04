/**
 * Plugin — extension unit that contributes activities, sidebars, skills, tools, renderers, and settings.
 * Managed by PluginRegistry / PluginLoader in main process.
 */

import type { ComponentType } from 'react'

export type PluginStatus = 'registered' | 'loading' | 'active' | 'error' | 'inactive' | 'unloaded'

export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  activityEntries?: PluginActivityEntry[]
  sidebarViews?: PluginSidebarView[]
  skills?: string[]
  tools?: string[]
  inlineRenderers?: string[]
  artifactTypes?: string[]
  artifactRenderers?: string[]
  artifactActions?: string[]
  settingsPages?: string[]
  permissionDefaults?: Record<string, 'allow' | 'ask' | 'deny'>
}

export interface PluginActivityEntry {
  id: string
  label: string
  icon: string // icon name from lucide or plugin icon set
  order?: number
}

export interface PluginSidebarView {
  activityId: string
  component: string // component key resolved by sidebarRegistry
  title: string
  order?: number
}

/** Runtime instance tracked by PluginLoader */
export interface PluginInstance {
  manifest: PluginManifest
  status: PluginStatus
  activatedAt?: number
  error?: string
  errorCount: number
  maxErrors: number
}

/** Renderer-side plugin view component registry entry */
export interface PluginViewRegistration {
  pluginId: string
  viewKey: string
  component: ComponentType<unknown>
}
