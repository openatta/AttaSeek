/**
 * Plugin — extension unit that contributes activities, sidebars, skills, tools, renderers, and settings.
 * Managed by PluginRegistry / PluginLoader in main process.
 */

import type { ComponentType } from 'react'

export type PluginStatus = 'registered' | 'loading' | 'active' | 'error' | 'inactive' | 'unloaded'

// ── Plugin manifest (canonical source) ──

export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  /** Engine compatibility constraints */
  engines?: { attaseek: string }
  /** Plugin dependencies */
  dependencies?: Record<string, string>

  // ── UI contributions (renderer-side) ──
  activityEntries?: PluginActivityEntry[]
  sidebarViews?: PluginSidebarView[]
  inlineRenderers?: string[]
  artifactTypes?: string[]
  artifactRenderers?: string[]
  artifactActions?: string[]
  settingsPages?: string[]

  // ── Agent contributions (main-process side) ──
  skills?: string[]
  tools?: string[]
  /** Paths to hook configuration files */
  hooks?: string[]
  /** Paths to MCP server configuration files */
  mcpServers?: string[]
  /** Paths to agent profile directories */
  agents?: string[]
  /** Paths to artifact renderer files */
  renderers?: string[]
  /** Paths to activity definitions */
  activities?: string[]
  /** Permission defaults for tools provided by this plugin */
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

// ── Plugin marketplace (reserved — future implementation) ──

export interface PluginMarketplace {
  search(query: string): Promise<PluginListing[]>
  install(pluginId: string, version?: string): Promise<void>
  uninstall(pluginId: string): Promise<void>
  getListing(pluginId: string): Promise<PluginListing | null>
}

export interface PluginListing {
  id: string
  name: string
  description: string
  version: string
  author: string
  downloads: number
  rating: number
}
