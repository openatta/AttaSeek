/**
 * AutoClassifier — LLM-based tool safety classifier.
 *
 * Uses a cheap model (Haiku) to evaluate tool calls before prompting the user
 * for permission. Mirrors Claude Code's `LlmAutoClassifier` pattern.
 *
 * When a tool call has riskLevel "risky", the classifier can:
 *   - Downgrade to "allow" if the specific parameters make it clearly safe
 *   - Escalate to "deny" if the parameters make it clearly dangerous
 *   - Leave as "ask" if the model is uncertain (default behavior)
 *
 * This runs asynchronously and is best-effort. If the classifier is unavailable
 * or times out, the original risk level is preserved.
 */

import type { LLMMessage } from '../agent/llm/ModelProvider'

// ── Types ──

export interface ClassifyInput {
  toolName: string
  toolInput: Record<string, unknown>
  toolDescription: string
}

export type ClassifyDecision = 'allow' | 'ask' | 'deny'

// ── Classification prompt ──

const CLASSIFY_SYSTEM_PROMPT = [
  'You are a security classifier for a coding assistant. Your job is to evaluate whether a tool call is safe to execute without user confirmation.',
  '',
  'Rules:',
  '- "allow" — the operation is clearly safe and reversible (e.g., reading a file, listing directories, searching code)',
  '- "ask" — the operation could modify state or access sensitive data (e.g., modifying files, installing packages, accessing credentials)',
  '- "deny" — the operation is clearly dangerous or potentially destructive (e.g., deleting files, modifying system config, executing privileged commands)',
  '',
  'Only output ONE word: allow, ask, or deny.',
].join('\n')

function buildClassifyPrompt(input: ClassifyInput): string {
  const params = JSON.stringify(input.toolInput, null, 2).slice(0, 2000)
  return [
    `Tool: ${input.toolName}`,
    `Description: ${input.toolDescription}`,
    `Parameters:`,
    '```json',
    params,
    '```',
    '',
    'Classification (allow / ask / deny):',
  ].join('\n')
}

// ── Heuristic fast path (no LLM call needed) ──

/**
 * Quick heuristic classification for known tool patterns.
 * Returns null if the LLM should be consulted.
 */
function heuristicClassify(input: ClassifyInput): ClassifyDecision | null {
  const { toolName, toolInput } = input

  // Clearly read-only tools
  const readOnlyPrefixes = ['read', 'list', 'get', 'search', 'find', 'show', 'view', 'cat', 'ls']
  for (const prefix of readOnlyPrefixes) {
    if (toolName.startsWith(prefix)) return 'allow'
  }

  // Known safe tools
  const safeTools = ['Skill', 'Task', 'AskUserQuestion', 'TodoWrite', 'structured_output']
  if (safeTools.includes(toolName)) return 'allow'

  // Bash: check for dangerous patterns
  if (toolName === 'Bash') {
    const cmd = String(toolInput['command'] || toolInput['cmd'] || '')
    const dangerousPatterns = ['rm ', 'rm -rf', 'sudo ', 'chmod', 'chown', 'dd ', 'mkfs', ':(){ ', '> /dev/sda', 'format']
    if (dangerousPatterns.some(p => cmd.includes(p))) return 'deny'
    const safePatterns = ['ls ', 'cat ', 'echo ', 'pwd', 'which ', 'whoami', 'date', 'git status', 'git diff', 'git log', 'grep ', 'find ', 'head ', 'tail ', 'wc ']
    if (safePatterns.some(p => cmd.startsWith(p))) return 'allow'
  }

  // File write: check for destructive patterns
  if (toolName === 'Write' || toolName === 'Edit') {
    const filePath = String(toolInput['filePath'] || toolInput['file_path'] || '')
    // Writing to system directories is dangerous
    const dangerousPaths = ['/etc/', '/proc/', '/sys/', '/dev/', '~/.ssh/', '/boot/']
    if (dangerousPaths.some(p => filePath.includes(p))) return 'deny'
    // Writing to project files is normal
    return 'allow'
  }

  // File delete
  if (toolName === 'Delete' || toolName === 'rm') {
    return 'deny'
  }

  // Unknown — let LLM decide
  return null
}

// ── Public API ──

/**
 * Classify a tool call's safety using heuristics first, then LLM fallback.
 *
 * @param input — the tool call to classify
 * @param callLLM — function to call a cheap LLM (injected for testability)
 * @returns ClassifyDecision (default: 'ask' if classification fails)
 */
export async function classifyToolCall(
  input: ClassifyInput,
  callLLM?: (messages: LLMMessage[]) => Promise<string>,
): Promise<ClassifyDecision> {
  // Fast path: heuristic classification
  const heuristic = heuristicClassify(input)
  if (heuristic !== null) return heuristic

  // Slow path: LLM classification
  if (!callLLM) return 'ask' // no LLM available → conservative default

  try {
    const messages: LLMMessage[] = [
      { role: 'user', content: CLASSIFY_SYSTEM_PROMPT },
      { role: 'user', content: buildClassifyPrompt(input) },
    ]

    const result = await callLLM(messages)
    const trimmed = result.trim().toLowerCase()

    if (trimmed.startsWith('allow')) return 'allow'
    if (trimmed.startsWith('deny')) return 'deny'
    return 'ask'
  } catch {
    // Classification failed — conservative default
    return 'ask'
  }
}

/**
 * Determine whether a tool call should skip the permission dialog
 * based on classification result.
 */
export function shouldSkipPermission(decision: ClassifyDecision): boolean {
  return decision === 'allow'
}

export function shouldBlock(decision: ClassifyDecision): boolean {
  return decision === 'deny'
}
