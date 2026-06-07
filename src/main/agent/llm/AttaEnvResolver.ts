/**
 * AttaEnvResolver — resolves environment variable overrides for LLM configuration.
 *
 * Priority chain:
 *   ATTA_* (primary) → ANTHROPIC_* (anthropic-type fallback) → OPENAI_* (openai-type fallback) → CLAUDE_CODE_* (legacy)
 *
 * Includes slot-aware env vars for all 10 model slots.
 */

// ── Resolved overrides ──

export interface EnvOverrides {
  authToken?: string
  baseUrl?: string
  model?: string
  opusModel?: string
  sonnetModel?: string
  haikuModel?: string
  smallFastModel?: string
  subagentModel?: string
  strongModel?: string
  fallbackModel?: string
  classifierModel?: string
  compactModel?: string
  effortLevel?: string
  maxTokens?: number
  compactThreshold?: number
}

// ── Env var definitions (ATTA_* → fallback chain) ──

interface EnvVarDef {
  key: keyof EnvOverrides
  primary: string       // ATTA_* var
  fallbacks: string[]   // Ordered fallback env vars
}

const ENV_VAR_DEFS: EnvVarDef[] = [
  // Core connection
  { key: 'authToken',      primary: 'ATTA_AUTH_TOKEN',           fallbacks: ['ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY'] },
  { key: 'baseUrl',        primary: 'ATTA_BASE_URL',             fallbacks: ['ANTHROPIC_BASE_URL', 'OPENAI_BASE_URL'] },
  { key: 'model',          primary: 'ATTA_MODEL',                fallbacks: ['ANTHROPIC_MODEL', 'OPENAI_MODEL'] },
  // Three-tier models
  { key: 'opusModel',      primary: 'ATTA_DEFAULT_OPUS_MODEL',   fallbacks: ['ANTHROPIC_DEFAULT_OPUS_MODEL', 'OPENAI_DEFAULT_OPUS_MODEL'] },
  { key: 'sonnetModel',    primary: 'ATTA_DEFAULT_SONNET_MODEL', fallbacks: ['ANTHROPIC_DEFAULT_SONNET_MODEL', 'OPENAI_DEFAULT_SONNET_MODEL'] },
  { key: 'haikuModel',     primary: 'ATTA_DEFAULT_HAIKU_MODEL',  fallbacks: ['ANTHROPIC_DEFAULT_HAIKU_MODEL', 'OPENAI_DEFAULT_HAIKU_MODEL'] },
  // Extended slots
  { key: 'smallFastModel', primary: 'ATTA_SMALL_FAST_MODEL',     fallbacks: ['ANTHROPIC_SMALL_FAST_MODEL'] },
  { key: 'subagentModel',  primary: 'ATTA_SUBAGENT_MODEL',       fallbacks: ['CLAUDE_CODE_SUBAGENT_MODEL'] },
  { key: 'strongModel',    primary: 'ATTA_STRONG_MODEL',         fallbacks: [] },
  { key: 'fallbackModel',  primary: 'ATTA_FALLBACK_MODEL',       fallbacks: [] },
  { key: 'classifierModel',primary: 'ATTA_CLASSIFIER_MODEL',     fallbacks: [] },
  { key: 'compactModel',   primary: 'ATTA_COMPACT_MODEL',        fallbacks: [] },
  // Options
  { key: 'effortLevel',    primary: 'ATTA_EFFORT_LEVEL',         fallbacks: ['CLAUDE_CODE_EFFORT_LEVEL'] },
  { key: 'maxTokens',      primary: 'ATTA_MAX_TOKENS',           fallbacks: [] },
  { key: 'compactThreshold', primary: 'ATTA_COMPACT_THRESHOLD',  fallbacks: [] },
]

// ── Resolution ──

/** Read a single env var, trying primary then each fallback */
function readEnv(primary: string, fallbacks: string[]): string | undefined {
  if (process.env[primary]) return process.env[primary]
  for (const fb of fallbacks) {
    if (process.env[fb]) return process.env[fb]
  }
  return undefined
}

/** Resolve all environment variable overrides at once */
export function resolveEnvOverrides(): EnvOverrides {
  const overrides: EnvOverrides = {}

  for (const def of ENV_VAR_DEFS) {
    const raw = readEnv(def.primary, def.fallbacks)
    if (raw !== undefined) {
      if (def.key === 'maxTokens' || def.key === 'compactThreshold') {
        const num = parseInt(raw, 10)
        if (!isNaN(num)) {
          (overrides as Record<string, unknown>)[def.key] = num
        }
      } else {
        (overrides as Record<string, unknown>)[def.key] = raw
      }
    }
  }

  return overrides
}
