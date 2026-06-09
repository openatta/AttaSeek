/**
 * Shared constants — truncation limits, timeouts, and other magic numbers.
 * Import from both main and renderer processes.
 */

// ── Content truncation ──

/** Short inline content (error summaries, chip labels) */
export const TRUNCATE_SHORT = 200

/** Medium content (tool input previews, notification bodies) */
export const TRUNCATE_MEDIUM = 500

/** Standard content truncation (artifact previews, tool results) */
export const TRUNCATE_STANDARD = 1000

/** Long content (full file content, terminal output) */
export const TRUNCATE_LONG = 2000

/** Error output / stderr truncation */
export const TRUNCATE_ERROR = 10000

// ── ID truncation ──

/** Short ID prefix for display (session IDs, etc.) */
export const ID_PREFIX_LENGTH = 8

/** Medium ID prefix (log entries) */
export const ID_LOG_LENGTH = 12

// ── List limits ──

/** Default max session list size */
export const MAX_SESSION_LIST = 200

/** Max tool call history per session in event bus */
export const MAX_EVENT_HISTORY = 1000

/** Max renderer-side events per session */
export const MAX_RENDERER_EVENTS = 2000

/** Max search/grep results per tool call */
export const MAX_SEARCH_RESULTS = 50

/** Max concurrent tool executions */
export const MAX_PARALLEL_TOOLS = 16

/** Max subagent lifetime before cleanup (ms) */
export const SUBAGENT_IDLE_CLEANUP_MS = 300_000

/** Directory for sub-agent output files (persisted for task_output tool). */
export const SUBAGENT_OUTPUT_DIR = '~/.atta/seek/tasks'

// ── Timeouts ──

/** Default shell command timeout (ms) */
export const DEFAULT_COMMAND_TIMEOUT_MS = 30_000

/** Default network request timeout (ms) */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

/** API key validation timeout (ms) */
export const KEY_VALIDATION_TIMEOUT_MS = 10_000

/** Quick connectivity check timeout (ms) */
export const CONNECTIVITY_CHECK_TIMEOUT_MS = 5_000

// ── Agent recovery ──

/** Max L1 (transparent retry) attempts */
export const RECOVERY_L1_MAX_ATTEMPTS = 1

/** Max L2 (wait-retry) attempts */
export const RECOVERY_L2_MAX_ATTEMPTS = 2

/** Max L3 (reactive compact) attempts */
export const RECOVERY_L3_MAX_ATTEMPTS = 2

/** L2 wait-retry base delay (ms) */
export const RECOVERY_L2_WAIT_BASE_MS = 1_000

/** L2 wait-retry max delay (ms) */
export const RECOVERY_L2_WAIT_MAX_MS = 3_000

/** L4 context collapse: turns to keep */
export const RECOVERY_L4_KEEP_TURNS = 2

// ── Memory extraction ──

/** Drain timeout for pending memory batches (ms) */
export const MEMORY_DRAIN_TIMEOUT_MS = 500

/** Preview length for message content in memory extraction */
export const MEMORY_PREVIEW_CHARS = 50

/** Max context length for LLM memory extraction */
export const MEMORY_MAX_CONTEXT_CHARS = 20_000

// ── Compaction ──

/** Max chars per message in compact prompt */
export const COMPACT_MSG_TRUNCATE_CHARS = 2_000

/** Max tool result chars before microcompact truncation */
export const MICROCOMPACT_MAX_TOOL_RESULT_CHARS = 10_000

/** Aggressive truncation for reactive compact */
export const REACTIVE_COMPACT_MIN_CHARS = 5_000

// ── Time-based microcompact ──

/**
 * Trigger time-based microcompact when (now − last assistant timestamp)
 * exceeds this many minutes. 60 min equals the server-side prompt cache TTL,
 * so we clear old tool results before the cache expires to avoid rewriting
 * stale data on cache miss.
 */
export const TIME_MICROCOMPACT_GAP_MINUTES = 60

/** Keep this many most-recent compactable tool results when time-based MC fires. */
export const TIME_MICROCOMPACT_KEEP_RECENT = 5

/** Minimum message count before time-based microcompact activates. */
export const TIME_MICROCOMPACT_MIN_MESSAGES = 10

// ── Snip compaction defaults ──

/** Default: keep first N messages as head. */
export const SNIP_DEFAULT_KEEP_HEAD = 2

/** Default: keep last N turn-pairs as tail. */
export const SNIP_DEFAULT_KEEP_TAIL_TURNS = 5

/** Minimum total messages before snip activates. */
export const SNIP_DEFAULT_MIN_MESSAGES = 20

// ── Compaction warning ──

/**
 * When token usage reaches this ratio of the budget, emit a warning
 * before compaction is triggered. Allows the user to see a heads-up
 * before the conversation is summarised.
 */
export const COMPACT_WARNING_TRIGGER_RATIO = 0.75

/** Suppress repeated compact warnings within this many milliseconds. */
export const COMPACT_WARNING_SUPPRESS_MS = 60_000

// ── File state cache ──

/** Maximum entries in the file state cache LRU. */
export const FILE_CACHE_MAX_ENTRIES = 1000

/** File state cache TTL in milliseconds (30 seconds). */
export const FILE_CACHE_TTL_MS = 30_000

// ── Orchestrator ──

/** Tool result content truncation limit in orchestrator */
export const TOOL_RESULT_TRUNCATE_LIMIT = 4_000
