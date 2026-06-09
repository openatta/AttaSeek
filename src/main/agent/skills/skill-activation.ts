/**
 * skill-activation — Conditional skill activation based on path matching.
 *
 * Mirrors Claude Code's conditional skills: skills can declare `paths`
 * in their frontmatter (gitignore-style patterns). When files matching
 * those patterns are touched by tool calls, the skill auto-activates.
 *
 * If no paths are declared, the skill is always active.
 */

import type { SkillManifest } from '../../../shared/types/Skill'

// ── Types ──

export interface ActivationContext {
  /** Files touched in recent tool calls (read, write, edit, glob, grep results). */
  touchedFiles: string[]
  /** Current working directory for relative path resolution. */
  cwd: string
}

// ── Pattern matching (minimatch-free, gitignore-style) ──

/**
 * Check if a file path matches a gitignore-style pattern.
 * Supports: *, **, ?, [abc], and leading / for anchored patterns.
 */
function matchGitignorePattern(pattern: string, filePath: string): boolean {
  // Normalize
  let p = pattern.trim()
  const f = filePath.replace(/\\/g, '/')

  // Negation patterns (handled by caller)
  if (p.startsWith('!')) return false

  // Strip leading / for anchored patterns
  const anchored = p.startsWith('/')
  if (anchored) p = p.slice(1)

  // Convert gitignore pattern to regex
  const regexStr = p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex chars
    .replace(/\*\*\//g, '(__DOUBLESTAR__)') // Placeholder for **/
    .replace(/\*\*/g, '.*')                  // ** matches anything
    .replace(/__DOUBLESTAR__/g, '(.*/)?')    // **/ matches zero or more dirs
    .replace(/\*/g, '[^/]*')                 // * matches anything except /
    .replace(/\?/g, '[^/]')                  // ? matches single non-slash char

  const regex = new RegExp(anchored ? `^${regexStr}` : regexStr)
  return regex.test(f)
}

/**
 * Check if a skill should be activated based on its path patterns
 * and the current set of touched files.
 */
export function shouldActivateSkill(
  skill: SkillManifest,
  ctx: ActivationContext,
): boolean {
  const paths = (skill as any).paths as string[] | undefined
  if (!paths || paths.length === 0) return true // No paths → always active

  // Separate positive and negative patterns
  const positive = paths.filter(p => !p.startsWith('!'))
  const negative = paths.filter(p => p.startsWith('!')).map(p => p.slice(1))

  if (positive.length === 0) return true

  for (const file of ctx.touchedFiles) {
    // Check negative patterns first (exclusions)
    const excluded = negative.some(pat => matchGitignorePattern(pat, file))
    if (excluded) continue

    // Check positive patterns
    const included = positive.some(pat => matchGitignorePattern(pat, file))
    if (included) return true
  }

  return false
}

/**
 * Filter a list of skills to only those that should be active
 * given the current activation context.
 */
export function filterActiveSkills(
  skills: SkillManifest[],
  ctx: ActivationContext,
): SkillManifest[] {
  return skills.filter(s => shouldActivateSkill(s, ctx))
}

/**
 * Extract touched file paths from tool call results.
 * Scans read_file, write_file, edit_file, glob, and grep outputs.
 */
export function extractTouchedFiles(
  toolCalls: Array<{ name: string; input: unknown; output?: unknown }>,
): string[] {
  const files = new Set<string>()

  for (const call of toolCalls) {
    const input = call.input as Record<string, unknown> | undefined
    if (!input) continue

    switch (call.name) {
      case 'read_file':
      case 'write_file':
      case 'edit_file':
        addPath(input.filePath || input.file_path, files)
        break
      case 'glob': {
        const output = String(call.output ?? '')
        output.split('\n').filter(Boolean).forEach(f => files.add(f.trim()))
        break
      }
      case 'grep':
      case 'search_code':
      case 'search_content': {
        const output = String(call.output ?? '')
        // Extract file paths from grep output lines (file:line:content)
        for (const line of output.split('\n')) {
          const match = line.match(/^([^:]+):\d+:/)
          if (match) files.add(match[1].trim())
        }
        break
      }
      case 'lsp_definition':
      case 'lsp_references':
      case 'lsp_diagnostic':
        addPath(input.filePath || input.file_path, files)
        break
    }
  }

  return [...files]
}

function addPath(p: unknown, files: Set<string>): void {
  if (typeof p === 'string' && p.trim()) {
    files.add(p.trim())
  }
}
