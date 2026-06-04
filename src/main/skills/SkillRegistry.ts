/**
 * SkillRegistry — stores and queries available skills.
 * Skills are registered by plugins or built-in packs.
 */

import type { SkillManifest, SkillLayer } from '../../renderer/core/types/Skill'
import type { AgentTask } from '../../renderer/core/types/AgentTask'

export class SkillRegistry {
  private skills: Map<string, SkillManifest> = new Map()

  /** Register a skill manifest */
  register(skill: SkillManifest): void {
    if (this.skills.has(skill.id)) {
      console.warn(`[SkillRegistry] overwriting skill: ${skill.id}`)
    }
    this.skills.set(skill.id, skill)
  }

  /** Register multiple skills at once (e.g., from a skill pack) */
  registerAll(skills: SkillManifest[]): void {
    for (const skill of skills) {
      this.register(skill)
    }
  }

  /** List all registered skills */
  list(): SkillManifest[] {
    return Array.from(this.skills.values())
  }

  /** Get a skill by ID */
  get(id: string): SkillManifest | undefined {
    return this.skills.get(id)
  }

  /** Find skills by layer */
  listByLayer(layer: SkillLayer): SkillManifest[] {
    return this.list().filter((s) => s.layer === layer)
  }

  /** Find skills relevant to a task goal (simple keyword match for MVP) */
  suggestForTask(task: AgentTask): SkillManifest[] {
    const goal = task.goal.toLowerCase()
    return this.list().filter((s) => {
      const searchText = `${s.name} ${s.description}`.toLowerCase()
      return goal.split(/\s+/).some((word) => searchText.includes(word))
    })
  }

  /** List skills by plugin */
  listByPlugin(pluginId: string): SkillManifest[] {
    return this.list().filter((s) => s.pluginId === pluginId)
  }

  /** Remove a skill */
  unregister(id: string): boolean {
    return this.skills.delete(id)
  }

  /** Remove all skills from a plugin */
  unregisterByPlugin(pluginId: string): void {
    for (const [id, skill] of this.skills) {
      if (skill.pluginId === pluginId) {
        this.skills.delete(id)
      }
    }
  }

  get count(): number {
    return this.skills.size
  }
}

/** Singleton */
export const skillRegistry = new SkillRegistry()
