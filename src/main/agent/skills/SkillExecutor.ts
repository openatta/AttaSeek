/**
 * SkillExecutor — Runtime execution engine for skills.
 *
 * Parses skill markdown content, expands arguments, executes inline
 * shell commands, and generates the final prompt for the LLM.
 *
 * Execution flow:
 *   1. Expand template arguments (${1}, ${2}, ${name}, ${CLAUDE_SKILL_DIR})
 *   2. Execute inline shell blocks (```bash ... ```) if skill has `shell` frontmatter
 *   3. Return the expanded prompt for injection into the system context
 *
 * Security: Shell execution is disabled by default. Skills must declare
 * `shell: true` in their frontmatter to enable it. Commands run with a
 * 30s timeout and 1MB output buffer.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { substituteArgs } from './SkillArgumentParser'
import type { SkillManifest } from '../../../shared/types/Skill'

const execAsync = promisify(exec)

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_OUTPUT_BUFFER = 1_000_000 // 1MB

// ── Types ──

export interface SkillExecOptions {
  /** Positional + named arguments from the skill invocation. */
  args?: Record<string, string>
  /** Skill directory path (for ${CLAUDE_SKILL_DIR} substitution). */
  skillDir?: string
  /** Session ID (for ${CLAUDE_SESSION_ID} substitution). */
  sessionId?: string
  /** Working directory for shell commands. */
  cwd?: string
}

export interface SkillExecResult {
  /** The fully expanded, ready-to-inject prompt. */
  prompt: string
  /** Output from any inline shell commands that were executed. */
  shellOutputs: string[]
  /** Whether any shell command failed. */
  shellErrors: boolean
}

// ── Execution ──

/**
 * Execute a skill: expand args, run inline shell, return the final prompt.
 *
 * @param skill     - The skill manifest (must have `body` containing markdown).
 * @param options   - Execution options (args, skillDir, sessionId, cwd).
 */
export async function executeSkill(
  skill: SkillManifest,
  options: SkillExecOptions = {},
): Promise<SkillExecResult> {
  const body = (skill as any).body as string | undefined
  if (!body) {
    return { prompt: `[Skill: ${skill.name}]`, shellOutputs: [], shellErrors: false }
  }

  const shellEnabled = (skill as any).shell === true
  const shellOutputs: string[] = []
  let shellErrors = false

  // Step 1: Expand template arguments
  // Convert options to SkillArgs format
  const skillArgs = {
    positional: Object.values(options.args || {}),
    named: options.args || {},
    skillDir: options.skillDir || '',
    sessionId: options.sessionId || '',
  }
  let expanded = substituteArgs(body, skillArgs)

  // Step 2: Execute inline shell blocks
  if (shellEnabled) {
    const shellBlocks = extractShellBlocks(expanded)
    for (const block of shellBlocks) {
      try {
        const { stdout, stderr } = await execAsync(block.command, {
          timeout: DEFAULT_TIMEOUT_MS,
          maxBuffer: MAX_OUTPUT_BUFFER,
          cwd: options.cwd,
          env: { ...process.env, CLAUDE_SKILL_DIR: options.skillDir || '', CLAUDE_SESSION_ID: options.sessionId || '' },
        })
        const output = (stdout + stderr).trim()
        expanded = expanded.replace(block.raw, `\`\`\`\n${output || '(no output)'}\n\`\`\``)
        if (output) shellOutputs.push(output)
      } catch (err) {
        shellErrors = true
        const errMsg = err instanceof Error ? err.message : String(err)
        expanded = expanded.replace(block.raw, `\`\`\`\nError: ${errMsg}\n\`\`\``)
        shellOutputs.push(`Error: ${errMsg}`)
      }
    }
  }

  return { prompt: expanded, shellOutputs, shellErrors }
}

// ── Shell block extraction ──

interface ShellBlock {
  raw: string
  language: string
  command: string
}

function extractShellBlocks(markdown: string): ShellBlock[] {
  const blocks: ShellBlock[] = []
  const regex = /```(bash|sh|shell|zsh)\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(markdown)) !== null) {
    blocks.push({
      raw: match[0],
      language: match[1],
      command: match[2].trim(),
    })
  }

  return blocks
}

/**
 * Quick sync check: does the skill body contain any shell blocks?
 * Used to validate the `shell` frontmatter declaration.
 */
export function hasShellBlocks(markdown: string): boolean {
  return /```(bash|sh|shell|zsh)\n[\s\S]*?```/.test(markdown)
}
