/**
 * SkillLoader — loads skills from filesystem (.claude/skills/{name}/SKILL.md).
 *
 * Each skill is a Markdown file with YAML frontmatter metadata.
 * Inspired by Claude Code's file-system skill loading pattern.
 */

import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import type { SkillManifest } from '../../../shared/types/Skill'
type SkillLayer = 'atomic' | 'scenario' | 'workflow'

interface SkillFrontmatter {
  name?: string
  description?: string
  layer?: SkillLayer
  tools?: string[]
  skills?: string[]
  riskLevel?: SkillManifest['riskLevel']
}

export async function loadSkillsFromDir(baseDir: string): Promise<SkillManifest[]> {
  const skillsDir = path.join(baseDir, '.atta', 'seek', 'skills')
  let entries: fs.Dirent[]
  try { entries = await fsp.readdir(skillsDir, { withFileTypes: true }) } catch { return [] }

  const skills: SkillManifest[] = []
  const dirs = entries.filter(e => e.isDirectory())
  const results = await Promise.all(dirs.map(async (entry) => {
    const skillFile = path.join(skillsDir, entry.name, 'SKILL.md')
    try {
      await fsp.access(skillFile)
      return parseSkillFile(skillFile, entry.name)
    } catch { return null }
  }))
  for (const s of results) { if (s) skills.push(s) }
  return skills
}

export async function loadSkillFile(filePath: string): Promise<SkillManifest | null> {
  try { await fsp.access(filePath) } catch { return null }
  try { return parseSkillFile(filePath, path.basename(path.dirname(filePath))) } catch { return null }
}

function parseSkillFile(filePath: string, skillId: string): SkillManifest | null {
  const raw = fs.readFileSync(filePath, 'utf-8') // sync is fine here — called once per file at boot
  const fm = parseFrontmatter(raw)

  return {
    id: skillId,
    name: fm.name || skillId,
    description: fm.description || '',
    layer: fm.layer || 'atomic',
    inputSchema: {},
    outputSchema: {},
    requiredTools: fm.tools || [],
    riskLevel: (fm.riskLevel as SkillManifest['riskLevel']) || 'low',
    defaultPlan: '',
    verificationRules: [],
    pluginId: '',
  }
}

function parseFrontmatter(content: string): SkillFrontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const meta: SkillFrontmatter = {}
  for (const line of match[1].split('\n')) {
    const keyMatch = line.match(/^(\w+):\s*(.*)$/)
    if (!keyMatch) continue
    const [, key, val] = keyMatch
    switch (key) {
      case 'tools': case 'skills':
        meta[key] = val.split(',').map(s => s.trim()).filter(Boolean)
        break
      case 'layer':
        meta.layer = val.trim() as SkillLayer
        break
      default:
        (meta as any)[key] = val.trim()
    }
  }
  return meta
}
