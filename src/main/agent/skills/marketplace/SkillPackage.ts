/**
 * SkillPackage — .skill compressed package format (tar.gz).
 *
 * Package structure:
 *   my-skill.skill (tar.gz)
 *   ├── manifest.json  — { name, version, author, dependencies }
 *   ├── SKILL.md       — skill instructions (frontmatter + markdown)
 *   ├── tools/         — custom tool implementations (optional)
 *   ├── prompts/       — prompt templates (optional)
 *   └── memory/        — preset memories (optional)
 */

import type { SkillManifest } from '../../../../shared/types/Skill'

export interface SkillPackageManifest {
  name: string
  version: string
  author?: string
  description?: string
  dependencies: {
    skills?: string[]
    tools?: string[]
  }
  minEngineVersion?: string
}

export interface SkillPackage {
  manifest: SkillPackageManifest
  skillMarkdown: string
  skillManifest: SkillManifest
  toolsDir?: string
  promptsDir?: string
  memoryDir?: string
}

export function validatePackage(manifest: SkillPackageManifest): string | null {
  if (!manifest.name) return 'Missing package name'
  if (!manifest.version) return 'Missing package version'
  if (!/^\d+\.\d+\.\d+/.test(manifest.version)) return `Invalid version: ${manifest.version}`
  return null // valid
}

export function isCompatible(pkg: SkillPackageManifest, engineVersion: string): boolean {
  if (!pkg.minEngineVersion) return true
  const [pMajor, pMinor] = pkg.minEngineVersion.split('.').map(Number)
  const [eMajor, eMinor] = engineVersion.split('.').map(Number)
  return eMajor > pMajor || (eMajor === pMajor && eMinor >= pMinor)
}
