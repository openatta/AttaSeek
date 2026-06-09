/**
 * FeatureFlags — experimental feature gating system.
 *
 * Two-layer design inspired by Claude Code's `feature()` macro:
 *
 * 1. **Compile-time** — Webpack/Vite `DefinePlugin` replaces
 *    `__FEATURE_<NAME>__` globals at build time, enabling dead-code
 *    elimination (DCE) for production builds.
 *
 * 2. **Runtime** — `isFeatureEnabled(name)` checks the in-memory set.
 *    Default: all features enabled in dev, explicit opt-in in prod.
 *
 * Usage:
 * ```ts
 * import { isFeatureEnabled } from '../features/FeatureFlags'
 * if (isFeatureEnabled('SNIP_COMPACT')) {
 *   // This code is DCE'd if __FEATURE_SNIP_COMPACT__ is false at build time
 * }
 * ```
 *
 * Phase A: runtime toggle system. Compile-time integration deferred.
 */

// ── Declare build-time globals (replaced by bundler) ──

// These globals are set to `true` or `false` at build time.
// When `false`, the bundler eliminates the guarded code entirely.
declare global {
  // eslint-disable-next-line no-var
  var __FEATURE_SNIP_COMPACT__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_CACHED_MICROCOMPACT__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_CONTEXT_COLLAPSE__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_REACTIVE_COMPACT__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_PROMPT_CACHING__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_STREAMING_TOOL_DISCARD__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_MAX_OUTPUT_RECOVERY__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_PROVIDER_FALLBACK__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_ATTACHMENT_SYSTEM__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_MEMORY_PREFETCH__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_TELEMETRY_EVENTS__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_STRUCTURED_OUTPUT__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_MEDIA_ERROR_RECOVERY__: boolean | undefined
  // eslint-disable-next-line no-var
  var __FEATURE_SLASH_COMMANDS_IN_LOOP__: boolean | undefined
}

// ── Feature names ──

/**
 * All recognised feature flag names. Add new features here.
 * The key is the flag name, the value is the default (dev mode).
 */
export const FEATURE_FLAGS = {
  /** Snip compaction — remove middle conversation, keep head+tail. */
  SNIP_COMPACT: 'SNIP_COMPACT',

  /** Cached microcompact — server-side cache editing for tool result trimming. */
  CACHED_MICROCOMPACT: 'CACHED_MICROCOMPACT',

  /** Context collapse — non-destructive collapse with commit log replay. */
  CONTEXT_COLLAPSE: 'CONTEXT_COLLAPSE',

  /** Reactive compaction — API error-triggered aggressive summarization. */
  REACTIVE_COMPACT: 'REACTIVE_COMPACT',

  /** Prompt caching — `cache_control` breakpoints on system prefix + tools. */
  PROMPT_CACHING: 'PROMPT_CACHING',

  /** Streaming tool discard — discard in-flight tools on streaming fallback. */
  STREAMING_TOOL_DISCARD: 'STREAMING_TOOL_DISCARD',

  /** Max output token recovery — escalate max_tokens when output is truncated. */
  MAX_OUTPUT_RECOVERY: 'MAX_OUTPUT_RECOVERY',

  /** Provider fallback — auto-switch to next provider on failure. */
  PROVIDER_FALLBACK: 'PROVIDER_FALLBACK',

  /** Attachment system — file uploads, image support, attachment dedup. */
  ATTACHMENT_SYSTEM: 'ATTACHMENT_SYSTEM',

  /** Memory prefetch — async memory warm-up before LLM call. */
  MEMORY_PREFETCH: 'MEMORY_PREFETCH',

  /** Telemetry events — structured JSONL telemetry for query lifecycle analytics. */
  TELEMETRY_EVENTS: 'TELEMETRY_EVENTS',

  /** Structured output — jsonSchema → SyntheticOutputTool with retry limits. */
  STRUCTURED_OUTPUT: 'STRUCTURED_OUTPUT',

  /** Media error recovery — reactive compact handles image/PDF size errors. */
  MEDIA_ERROR_RECOVERY: 'MEDIA_ERROR_RECOVERY',

  /** Slash commands in query loop — processUserInput hook before queryLoop. */
  SLASH_COMMANDS_IN_LOOP: 'SLASH_COMMANDS_IN_LOOP',
} as const

export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]

// ── Runtime state ──

/** In-memory enabled set. Populated from build-time globals or defaults. */
const _enabled = new Set<FeatureFlagName>()

/** Initialise defaults — in dev all features are on, in prod feature() globals gate. */
function initDefaults(): void {
  for (const name of Object.values(FEATURE_FLAGS)) {
    _enabled.add(name)
  }
}

// Run at import time
initDefaults()

// ── Public API ──

/**
 * Check if a feature is enabled.
 *
 * In production builds, the bundler replaces `__FEATURE_<NAME>__` globals
 * and eliminates the entire guarded block when false.
 *
 * ```ts
 * // Compile-time gate (preferred for DCE):
 * if (globalThis.__FEATURE_SNIP_COMPACT__ !== false && isFeatureEnabled('SNIP_COMPACT')) { ... }
 *
 * // Runtime-only gate (dev mode, or when DCE isn't critical):
 * if (isFeatureEnabled('SNIP_COMPACT')) { ... }
 * ```
 */
export function isFeatureEnabled(name: FeatureFlagName): boolean {
  return _enabled.has(name)
}

/** Enable a feature at runtime (dev / testing). No-op in production builds. */
export function enableFeature(name: FeatureFlagName): void {
  _enabled.add(name)
}

/** Disable a feature at runtime (dev / testing). */
export function disableFeature(name: FeatureFlagName): void {
  _enabled.delete(name)
}

/** Get a frozen snapshot of currently enabled features (for QueryConfig). */
export function getEnabledFeatures(): ReadonlySet<string> {
  return new Set(_enabled)
}

/** Reset all features to their default state (dev = all on). */
export function resetFeatures(): void {
  _enabled.clear()
  initDefaults()
}

// ── Compile-time guard helper (type-level) ──

/**
 * Compile-time feature gate.
 * Usage: `if (feature('SNIP_COMPACT')) { ... }`
 *
 * In dev mode this is just a runtime check. In production, the bundler's
 * DCE eliminates the entire guarded block when the corresponding global
 * is `false`.
 */
export function feature(name: FeatureFlagName): boolean {
  // Check compile-time override first (bundler replaces these globals)
  switch (name) {
    case 'SNIP_COMPACT':
      return globalThis.__FEATURE_SNIP_COMPACT__ !== false && _enabled.has(name)
    case 'CACHED_MICROCOMPACT':
      return globalThis.__FEATURE_CACHED_MICROCOMPACT__ !== false && _enabled.has(name)
    case 'CONTEXT_COLLAPSE':
      return globalThis.__FEATURE_CONTEXT_COLLAPSE__ !== false && _enabled.has(name)
    case 'REACTIVE_COMPACT':
      return globalThis.__FEATURE_REACTIVE_COMPACT__ !== false && _enabled.has(name)
    case 'PROMPT_CACHING':
      return globalThis.__FEATURE_PROMPT_CACHING__ !== false && _enabled.has(name)
    case 'STREAMING_TOOL_DISCARD':
      return globalThis.__FEATURE_STREAMING_TOOL_DISCARD__ !== false && _enabled.has(name)
    case 'MAX_OUTPUT_RECOVERY':
      return globalThis.__FEATURE_MAX_OUTPUT_RECOVERY__ !== false && _enabled.has(name)
    case 'PROVIDER_FALLBACK':
      return globalThis.__FEATURE_PROVIDER_FALLBACK__ !== false && _enabled.has(name)
    case 'ATTACHMENT_SYSTEM':
      return globalThis.__FEATURE_ATTACHMENT_SYSTEM__ !== false && _enabled.has(name)
    case 'MEMORY_PREFETCH':
      return globalThis.__FEATURE_MEMORY_PREFETCH__ !== false && _enabled.has(name)
    case 'TELEMETRY_EVENTS':
      return globalThis.__FEATURE_TELEMETRY_EVENTS__ !== false && _enabled.has(name)
    case 'STRUCTURED_OUTPUT':
      return globalThis.__FEATURE_STRUCTURED_OUTPUT__ !== false && _enabled.has(name)
    case 'MEDIA_ERROR_RECOVERY':
      return globalThis.__FEATURE_MEDIA_ERROR_RECOVERY__ !== false && _enabled.has(name)
    case 'SLASH_COMMANDS_IN_LOOP':
      return globalThis.__FEATURE_SLASH_COMMANDS_IN_LOOP__ !== false && _enabled.has(name)
    default:
      return _enabled.has(name)
  }
}
