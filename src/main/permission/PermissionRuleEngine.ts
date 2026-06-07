/**
 * PermissionRuleEngine — rule-based permission decision pipeline.
 *
 * Three-stage pipeline:
 *   1. Check deny rules → if matched, DENY
 *   2. Check mode-level bypass → if allowed by mode, ALLOW
 *   3. Check allow rules → if matched, ALLOW
 *   Otherwise → default ASK
 *
 * Aligned with Claude Code's hasPermissionsToUseTool pattern.
 */

import type { PermissionMode } from './PermissionMode'
import { modeDefaultDecision, shouldAutoAllowRead, shouldAutoAllowSafeWrite } from './PermissionMode'

export type RuleDecision = 'allow' | 'deny' | 'ask'

export interface PermissionRule {
  id: string
  type: RuleDecision
  toolPattern: string
  source: 'user' | 'project' | 'local' | 'managed'
  createdAt: number
}

export class PermissionRuleEngine {
  private rules: PermissionRule[] = []

  addRule(rule: PermissionRule): void {
    // Dedup: replace existing rule with same pattern+source
    const existing = this.rules.findIndex(r => r.toolPattern === rule.toolPattern && r.source === rule.source)
    if (existing >= 0) this.rules[existing] = rule
    else this.rules.push(rule)
  }

  deleteRule(id: string): boolean {
    const idx = this.rules.findIndex(r => r.id === id)
    if (idx < 0) return false
    this.rules.splice(idx, 1)
    return true
  }

  getRules(): PermissionRule[] { return [...this.rules] }

  setRules(rules: PermissionRule[]): void { this.rules = [...rules] }

  /** Execute the full permission decision pipeline */
  decide(params: {
    toolName: string
    toolInput: Record<string, unknown>
    riskLevel: 'read' | 'write' | 'risky'
    mode: PermissionMode
    isPathSafe?: boolean  // for filesystem tools: is the path within workspace?
  }): RuleDecision {
    const { toolName, riskLevel, mode, isPathSafe } = params

    // Stage 1: Check deny rules
    for (const rule of this.rules) {
      if (rule.type === 'deny' && matchToolPattern(toolName, rule.toolPattern)) {
        return 'deny'
      }
    }

    // Stage 2: Mode-level bypass
    if (riskLevel === 'read' && shouldAutoAllowRead(mode)) return 'allow'
    if (riskLevel === 'write' && shouldAutoAllowSafeWrite(mode) && isPathSafe) return 'allow'

    // Stage 3: Check allow rules
    for (const rule of this.rules) {
      if (rule.type === 'allow' && matchToolPattern(toolName, rule.toolPattern)) {
        return 'allow'
      }
    }

    // Default: mode-level default
    return modeDefaultDecision(mode)
  }
}

// ── Pattern matching ──

function matchToolPattern(toolName: string, pattern: string): boolean {
  // Support: exact, wildcard, and "ToolName(input *)" syntax
  const namePart = pattern.split('(')[0].trim()
  const match = toolName === namePart || matchWildcard(toolName, namePart)
  if (!match) return false

  // Future: check input constraint inside parentheses
  // e.g., "Bash(git *)" matches Bash tool when input contains "git"
  return true
}

function matchWildcard(name: string, pattern: string): boolean {
  if (pattern === '*' || pattern === '') return true
  if (pattern.includes('*')) {
    const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    return re.test(name)
  }
  return false
}

export const permissionRuleEngine = new PermissionRuleEngine()
