/**
 * ModelTemplateService — built-in + custom model provider templates.
 * Supports environment variable API key auto-detection.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { BUILTIN_TEMPLATES } from './templates/builtin'

export interface ProviderInterface {
  type: 'anthropic' | 'openai_compatible'
  endpointUrl: string
  defaultModels: string[]
  defaultModel: string
}

export interface ModelTemplate {
  id: string; name: string; provider: string
  /** All officially supported interfaces. Providers like DeepSeek/Kimi/GLM/MiniMax support both. */
  interfaces: ProviderInterface[]
  envKey: string; apiKeyUrl: string; apiKeyHeader: string
  apiKeyPrefix?: string; recommendedParams: Record<string, unknown>
  iconType: string; region: 'international' | 'china'; version: number
}

let _userDir: string | null = null
function userDir(): string { if (!_userDir) _userDir = join(app.getPath('home'), '.atta', 'seek', 'model-templates'); return _userDir }

export function loadBuiltinTemplates(): ModelTemplate[] { return BUILTIN_TEMPLATES }

export function loadCustomTemplates(): ModelTemplate[] {
  try {
    if (!existsSync(userDir())) return []
    const files = readdirSync(userDir()).filter(f => f.endsWith('.json'))
    return files.map(f => {
      try { return JSON.parse(readFileSync(join(userDir(), f), 'utf-8')) as ModelTemplate }
      catch { return null }
    }).filter(Boolean) as ModelTemplate[]
  } catch { return [] }
}

export function loadAllTemplates(): ModelTemplate[] {
  const custom = loadCustomTemplates()
  const customIds = new Set(custom.map(t => t.id))
  return [...BUILTIN_TEMPLATES.filter(t => !customIds.has(t.id)), ...custom]
}

export function saveCustomTemplate(template: ModelTemplate): void {
  if (!existsSync(userDir())) mkdirSync(userDir(), { recursive: true })
  writeFileSync(join(userDir(), `${template.id}.json`), JSON.stringify(template, null, 2))
}

export function detectEnvApiKey(template: ModelTemplate): string | null {
  try { return process.env[template.envKey] || null }
  catch { return null }
}

export function detectAllEnvKeys(): { templateId: string; key: string }[] {
  return BUILTIN_TEMPLATES
    .map(t => ({ templateId: t.id, key: detectEnvApiKey(t) }))
    .filter(e => e.key !== null) as { templateId: string; key: string }[]
}
