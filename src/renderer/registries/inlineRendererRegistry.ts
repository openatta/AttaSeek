/**
 * inlineRendererRegistry — maps content types to Conversation inline renderer components.
 *
 * Used for lightweight previews inside Conversation (e.g., mini chart, markdown summary).
 * Full artifacts go to ArtifactPane; inline previews stay in the message flow.
 */

import type { ComponentType } from 'react'
import { Registry } from './Registry'

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

const registry = new Registry<InlineRendererRegistration>()

export function registerInlineRenderer(config: InlineRendererRegistration): void {
  registry.register(config.type, config)
}

export function getInlineRenderer(type: string): InlineRendererRegistration | undefined {
  return registry.get(type)
}

export function listInlineRenderers(): InlineRendererRegistration[] {
  return registry.list()
}

export function unregisterByPlugin(pluginId: string): void {
  registry.unregisterByPlugin(pluginId)
}
