/**
 * SkillSourceLoader — multi-source skill discovery and loading.
 *
 * Sources (in priority order, managed > user > project > bundled):
 *   - bundled: compiled-in skills (e.g., atta-* skills)
 *   - project: .claude/skills/ in the workspace root
 *   - user: ~/.claude/skills/ (user-level)
 *   - managed: policy/admin-managed skills
 *
 * When skills from different sources have the same ID, the highest-priority
 * source wins (managed overrides user, user overrides project, etc.).
 */

import * as path from 'path'
import * as os from 'os'
import type { SkillManifest } from '../../../shared/types/Skill'
import { loadSkillsFromDir } from './SkillLoader'
import { getBundledSkills } from './bundled-skills'

export type SkillSource = 'bundled' | 'project' | 'user' | 'managed'

const SOURCE_PRIORITY: SkillSource[] = ['managed', 'user', 'project', 'bundled']

export interface LoadedSkill {
  manifest: SkillManifest
  source: SkillSource
  sourcePath: string
}

/** Load skills from all configured sources, with priority-based dedup */
export async function loadSkillsFromAllSources(
  workspaceRoot?: string,
): Promise<LoadedSkill[]> {
  const sources = new Map<SkillSource, string[]>()

  // Bundled — compiled-in skills (registered via getBundledSkills)
  sources.set('bundled', ['(bundled)'])

  // Project — .claude/skills/ in workspace
  if (workspaceRoot) {
    const projectDir = path.join(workspaceRoot, '.claude', 'skills')
    sources.set('project', [projectDir])
  } else {
    sources.set('project', [])
  }

  // User — ~/.claude/skills/
  const userDir = path.join(os.homedir(), '.claude', 'skills')
  sources.set('user', [userDir])

  // Managed — reserved for enterprise policy
  sources.set('managed', [])

  const allSkills: LoadedSkill[] = []

  // Register bundled skills first
  const bundledSkills = getBundledSkills()
  for (const m of bundledSkills) {
    allSkills.push({ manifest: m as SkillManifest, source: 'bundled', sourcePath: '(bundled)' })
  }

  for (const source of ['bundled', 'project', 'user', 'managed'] as SkillSource[]) {
    const dirs = sources.get(source) || []
    for (const dir of dirs) {
      try {
        const manifests = await loadSkillsFromDir(dir)
        for (const m of manifests) {
          allSkills.push({ manifest: m, source, sourcePath: dir })
        }
      } catch {
        // best-effort: directory may not exist — skip
      }
    }
  }

  // Dedup by ID: highest-priority source wins
  const deduped = new Map<string, LoadedSkill>()
  for (const skill of allSkills) {
    const existing = deduped.get(skill.manifest.id)
    if (!existing || SOURCE_PRIORITY.indexOf(skill.source) < SOURCE_PRIORITY.indexOf(existing.source)) {
      deduped.set(skill.manifest.id, skill)
    }
  }

  return Array.from(deduped.values())
}
