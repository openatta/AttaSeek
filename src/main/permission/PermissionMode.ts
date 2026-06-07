/**
 * PermissionMode — permission mode definitions and mode-level behavior.
 *
 * Modes control the default permission behavior before rule matching.
 * Aligned with Claude Code's PermissionMode system.
 */

export type PermissionMode = 'default' | 'plan' | 'acceptEdits' | 'bypass'

/** Get the effective default decision for a mode */
export function modeDefaultDecision(mode: PermissionMode): 'ask' | 'allow' {
  switch (mode) {
    case 'bypass': return 'allow'
    case 'acceptEdits': return 'allow'  // only for safe edits, gated by path check
    case 'plan': return 'allow'         // for read-only tools only
    default: return 'ask'
  }
}

/** Check if a read-only tool should auto-allow in the given mode */
export function shouldAutoAllowRead(mode: PermissionMode): boolean {
  return mode === 'plan' || mode === 'bypass'
}

/** Check if a safe write should auto-allow in the given mode */
export function shouldAutoAllowSafeWrite(mode: PermissionMode): boolean {
  return mode === 'acceptEdits' || mode === 'bypass'
}

/** Human-readable labels */
export const PERMISSION_MODE_LABELS: Record<PermissionMode, string> = {
  default: 'Default — ask for each action',
  plan: 'Plan mode — read-only, plan first',
  acceptEdits: 'Accept edits — auto-approve safe edits',
  bypass: 'Bypass — skip permission checks (use with caution)',
}
