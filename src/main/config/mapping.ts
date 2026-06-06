/**
 * Configuration key mapping: Claude Code / Codex Desktop → AttaSeek.
 * Used by ThirdPartyImporter to translate settings during import.
 */

export const CLAUDE_TO_ATTASEEK: Record<string, string> = {
  theme: 'theme',
  model: 'modelConfigId',
  'permissions.defaultMode': 'permissionMode',
  alwaysThinkingEnabled: 'thinkingMode',
  fastMode: 'fastMode',
  cleanupPeriodDays: 'session.cleanupPeriodDays',
  outputStyle: 'outputStyle',
  editorMode: 'editor.mode',
  verbose: '(passthrough)',
  autoCompactEnabled: '(passthrough)',
}

export const CODEX_TO_ATTASEEK: Record<string, string> = {
  model: 'modelConfigId',
  model_reasoning_effort: 'reasoningEffort',
  personality: 'personality',
  sandbox_mode: 'sandbox.mode',
  appearanceTheme: 'theme',
  developer_instructions: 'developerInstructions',
  'features.fast_mode': 'fastMode',
  'desktop.ambient-suggestions-enabled': '(passthrough)',
}

/** Convert a third-party settings object to AttaSeek format using the mapping */
export function mapSettings(
  source: Record<string, unknown>,
  mapping: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [srcKey, dstKey] of Object.entries(mapping)) {
    const value = getNestedValue(source, srcKey)
    if (value !== undefined && !dstKey.startsWith('(')) {
      setNestedValue(result, dstKey, convertValue(dstKey, value))
    } else if (value !== undefined && dstKey === '(passthrough)') {
      result[srcKey] = value
    }
  }
  return result
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: any, k) => acc?.[k], obj)
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.')
  const last = keys.pop()!
  let current = obj
  for (const k of keys) {
    if (!current[k]) current[k] = {}
    current = current[k] as Record<string, unknown>
  }
  current[last] = value
}

const BOOLEAN_CONVERSIONS: Record<string, [string, string]> = {
  thinkingMode: ['true', 'enabled'],  // boolean true → 'enabled', false → 'disabled'
  fastMode: ['true', 'on'],           // boolean true → 'on', false → 'off'
}

function convertValue(dstKey: string, value: unknown): unknown {
  const conv = BOOLEAN_CONVERSIONS[dstKey]
  if (conv && typeof value === 'boolean') {
    return value ? conv[0] : conv[1]
  }
  if (dstKey === 'sandbox.mode' && typeof value === 'string') {
    // Codex: read-only→read-only, workspace-write→workspace-write, danger-full-access→danger-full-access
    if (['read-only', 'workspace-write', 'danger-full-access'].includes(value)) return value
  }
  return value
}
