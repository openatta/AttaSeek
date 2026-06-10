/**
 * PaneRegistry — maps Pane types to their React components and constraints.
 *
 * Follows the same Registry<T> pattern as artifactRendererRegistry.
 * Each Pane is independently implemented; the AP Tab container uses
 * this registry to look up the correct component for each tab.
 */

import type { ComponentType } from 'react'
import { Registry } from '../../registries/Registry'

export type PaneType = 'browser' | 'terminal' | 'file' | 'review'

export interface PaneConstraints {
  /** Only one instance allowed at a time */
  singleInstance: boolean
  /** Requires project context (root path available) */
  requireProject: boolean
}

export interface PaneProps {
  apTabId: string
}

export interface PaneRegistration {
  type: PaneType
  component: ComponentType<PaneProps>
  label: string
  icon: string
  constraints: PaneConstraints
  pluginId?: string
}

const registry = new Registry<PaneRegistration>()

export function registerPane(config: PaneRegistration): void {
  registry.register(config.type, config)
}

export function getPane(type: PaneType): PaneRegistration | undefined {
  return registry.get(type)
}

export function listPanes(predicate?: (p: PaneRegistration) => boolean): PaneRegistration[] {
  return registry.list(predicate)
}

export function unregisterByPlugin(pluginId: string): void {
  registry.unregisterByPlugin(pluginId)
}

export { registry as paneRegistry }
