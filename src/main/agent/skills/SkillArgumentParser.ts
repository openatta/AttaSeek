/**
 * SkillArgumentParser — substitutes template variables in skill prompts.
 *
 * Supports:
 *   ${1}, ${2}, ...  — positional arguments from invocation
 *   ${name}          — named arguments from invocation
 *   ${CLAUDE_SKILL_DIR} — path to the skill's directory
 *   ${CLAUDE_SESSION_ID} — current session ID
 */

export interface SkillArgs {
  positional: string[]
  named: Record<string, string>
  skillDir: string
  sessionId: string
}

/** Substitute template variables in skill content */
export function substituteArgs(content: string, args: SkillArgs): string {
  let result = content

  // ${CLAUDE_SKILL_DIR} — skill directory path
  result = result.replace(/\$\{CLAUDE_SKILL_DIR\}/g, args.skillDir)

  // ${CLAUDE_SESSION_ID} — current session ID
  result = result.replace(/\$\{CLAUDE_SESSION_ID\}/g, args.sessionId)

  // ${1}, ${2}, ... — positional arguments
  result = result.replace(/\$\{(\d+)\}/g, (_match, index) => {
    const i = parseInt(index, 10) - 1
    return args.positional[i] ?? `\${${index}}`
  })

  // ${name} — named arguments
  result = result.replace(/\$\{([a-zA-Z_]\w*)\}/g, (_match, name) => {
    return args.named[name] ?? `\${${name}}`
  })

  return result
}

/** Extract argument definitions from skill frontmatter */
export interface ArgDef {
  name: string
  description: string
  required: boolean
}

export function parseArgDefs(rawArgs: unknown): ArgDef[] {
  if (!Array.isArray(rawArgs)) return []
  return rawArgs.map((a: Record<string, unknown>) => ({
    name: String(a.name || ''),
    description: String(a.description || ''),
    required: Boolean(a.required),
  }))
}
