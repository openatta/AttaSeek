/**
 * ToolRegistry — centralized catalog of all available tools.
 * Tools are registered by plugins or built-in capability packs.
 */

import type { ToolManifest, ToolRiskLevel } from '../../renderer/core/types/Tool'

export class ToolRegistry {
  private tools: Map<string, ToolManifest> = new Map()

  /** Register a tool manifest */
  register(tool: ToolManifest): void {
    if (this.tools.has(tool.id)) {
      console.warn(`[ToolRegistry] overwriting tool: ${tool.id}`)
    }
    this.tools.set(tool.id, tool)
  }

  /** Register multiple tools */
  registerAll(tools: ToolManifest[]): void {
    for (const tool of tools) {
      this.register(tool)
    }
  }

  /** List all registered tools */
  list(): ToolManifest[] {
    return Array.from(this.tools.values())
  }

  /** Get a tool by ID */
  get(id: string): ToolManifest | undefined {
    return this.tools.get(id)
  }

  /** List tools by risk level */
  listByRisk(risk: ToolRiskLevel): ToolManifest[] {
    return this.list().filter((t) => t.riskLevel === risk)
  }

  /** List tools by plugin */
  listByPlugin(pluginId: string): ToolManifest[] {
    return this.list().filter((t) => t.pluginId === pluginId)
  }

  /** Remove a tool */
  unregister(id: string): boolean {
    return this.tools.delete(id)
  }

  /** Remove all tools from a plugin */
  unregisterByPlugin(pluginId: string): void {
    for (const [id, tool] of this.tools) {
      if (tool.pluginId === pluginId) {
        this.tools.delete(id)
      }
    }
  }

  get count(): number {
    return this.tools.size
  }
}

/** Singleton */
export const toolRegistry = new ToolRegistry()
