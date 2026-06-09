/**
 * QueryConfig — immutable per-turn configuration snapshot.
 *
 * Captures environment, session metadata, and feature-flag state at
 * the moment queryLoop is entered. These values are read-only for the
 * entire turn — they do not change across loop iterations.
 *
 * Mirrors Claude Code's buildQueryConfig() (src/query/config.ts).
 */

// ── Query source (tracks who initiated this query) ──

/**
 * Identifies the caller of the query loop.
 * Mirrors Claude Code's QuerySource constants (src/constants/querySource.ts).
 */
export type QuerySource =
  | 'repl_main_thread'            // User-initiated in main conversation
  | 'repl_main_thread:outputStyle:Explanatory'
  | 'repl_main_thread:outputStyle:Learning'
  | 'agent:custom'                // Sub-agent with custom profile
  | 'agent:default'               // Sub-agent with default profile
  | 'agent:builtin'               // Built-in sub-agent (explore, plan, review, verify)
  | 'compact'                     // Compaction summarization call
  | 'memory_extraction'           // Memory extraction LLM call
  | 'title_generation'            // Session title generation
  | 'hook_agent'                  // Agent hook execution
  | 'hook_prompt'                 // Prompt hook execution
  | 'verification_agent'          // Verification sub-agent
  | 'side_question'               // Side-question (non-blocking)
  | 'classifier'                  // Auto-classifier (permission pre-check)
  | string                        // Allow extension for future sources

// ── Config snapshot ──

export interface QueryConfig {
  /** Who initiated this query loop invocation */
  querySource: QuerySource

  /** Session identifier (matches process-wide session ID) */
  sessionId: string

  /** Original CWD when the session started */
  originalCwd: string

  /** Is the session running in headless/SDK mode (no TUI)? */
  isHeadless: boolean

  /** Is bare mode active (minimal prompt, no CLAUDE.md auto-load)? */
  isBareMode: boolean

  /** Git availability flag (avoids repeated `git rev-parse` checks) */
  isGitAvailable: boolean

  /** Current platform (darwin / linux / win32) */
  platform: string

  /** Current OS release version */
  osRelease: string

  /** Current local date in ISO 8601 (YYYY-MM-DD) — captured once per turn */
  localDate: string

  /** Feature flags active for this turn (snapshot, not live) */
  features: ReadonlySet<string>
}

// ── Builder ──

let _defaultSessionId = ''
let _defaultCwd = process.cwd()

/** Set session-level defaults (called once at session start). */
export function initQueryConfig(sessionId: string, cwd?: string): void {
  _defaultSessionId = sessionId
  if (cwd) _defaultCwd = cwd
}

/**
 * Build a fresh QueryConfig snapshot.
 * Called at the top of each queryLoop invocation.
 */
export function buildQueryConfig(overrides?: Partial<QueryConfig>): QueryConfig {
  return {
    querySource: 'repl_main_thread',
    sessionId: _defaultSessionId,
    originalCwd: _defaultCwd,
    isHeadless: false,
    isBareMode: false,
    isGitAvailable: true, // Optimistic — GitContext can override after first check
    platform: process.platform,
    osRelease: process.getSystemVersion?.() ?? '', // macOS, else ''
    localDate: new Date().toISOString().slice(0, 10),
    features: new Set(), // Populated by FeatureFlags snapshot
    ...overrides,
  }
}
