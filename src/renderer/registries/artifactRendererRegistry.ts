/**
 * artifactRendererRegistry — maps Artifact types to renderer components.
 *
 * Plugins and built-in renderers register their components here.
 * ArtifactPane's ArtifactRendererHost uses this registry to select the
 * correct renderer for each artifact.
 */

import type { ComponentType } from 'react'
import type { ArtifactType, ArtifactRendererHint } from '../core/types/Artifact'
import { Registry } from './Registry'

export interface ArtifactRendererRegistration {
  /** The artifact type or renderer hint this handles */
  type: ArtifactType | ArtifactRendererHint
  /** React component that renders the artifact */
  component: ComponentType<ArtifactRendererProps>
  /** Human-readable label for tab display */
  label: string
  /** Plugin that registered this (undefined = built-in) */
  pluginId?: string
}

export interface ArtifactRendererProps {
  artifactId: string
  content: string
  title: string
  editable: boolean
  onContentChange?: (content: string) => void
}

const registry = new Registry<ArtifactRendererRegistration>()

export function registerArtifactRenderer(config: ArtifactRendererRegistration): void {
  registry.register(config.type, config)
}

export function getRenderer(type: string): ArtifactRendererRegistration | undefined {
  return registry.get(type)
}

export function listRenderers(): ArtifactRendererRegistration[] {
  return registry.list()
}

export function unregisterByPlugin(pluginId: string): void {
  registry.unregisterByPlugin(pluginId)
}
