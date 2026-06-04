/**
 * inlineRendererRegistry — maps content types to Conversation inline renderer components.
 *
 * Used for lightweight previews inside Conversation (e.g., mini chart, markdown summary).
 * Full artifacts go to ArtifactPane; inline previews stay in the message flow.
 */

import type { ComponentType } from 'react'

export interface InlineRendererRegistration {
  type: string
  component: ComponentType<InlineRendererProps>
  label: string
  pluginId?: string
}

export interface InlineRendererProps {
  content: string
  metadata?: Record<string, unknown>
}

const registry = new Map<string, InlineRendererRegistration>()

export function registerInlineRenderer(config: InlineRendererRegistration): void {
  if (registry.has(config.type)) {
    console.warn(`[inlineRendererRegistry] overwriting renderer for: ${config.type}`)
  }
  registry.set(config.type, config)
}

export function getInlineRenderer(type: string): InlineRendererRegistration | undefined {
  return registry.get(type)
}

export function listInlineRenderers(): InlineRendererRegistration[] {
  return Array.from(registry.values())
}

export function unregisterByPlugin(pluginId: string): void {
  for (const [key, reg] of registry) {
    if (reg.pluginId === pluginId) {
      registry.delete(key)
    }
  }
}
