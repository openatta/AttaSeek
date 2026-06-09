/**
 * ToolContextModifier — shared mutable context passed across tool executions.
 *
 * Each tool in a batch receives the current ToolUseContext and can
 * optionally return a context modifier that transforms it for the
 * next tool in the sequence. This enables tools like setConfig or
 * setModel to affect subsequent tools without global state.
 *
 * Mirrors Claude Code's ToolUseContext (src/Tool.ts).
 *
 * Phase D: full context modifier chain. Used by ToolOrchestrator
 * and StreamingToolExecutor to pass state between tools in a turn.
 */

// ── Core context interface ──

/**
 * Mutable context shared across all tool executions within a single turn.
 * Tools receive this via their execution context and can return a
 * modifier to update it for subsequent tools.
 */
export interface ToolUseContext {
  /** AbortController for this turn — aborting this stops the entire turn. */
  readonly abortController: AbortController

  /** Child controller — aborting this kills sibling processes (e.g., Bash)
   *  but does NOT abort the parent turn. Created fresh per batch. */
  readonly siblingAbortController: AbortController

  /** Set of tool-use IDs currently in progress (for UI spinner). */
  readonly inProgressToolUseIDs: ReadonlySet<string>

  /** Register/unregister a tool as in-progress. Returns the new set. */
  setInProgressToolUseIDs: (fn: (prev: Set<string>) => Set<string>) => void

  /** Agent identifier — non-empty for sub-agents (e.g., "explore", "plan"). */
  readonly agentId?: string

  /** Query chain tracking — chainId stays constant across a turn's iterations. */
  readonly queryTracking?: QueryTracking

  /** Content replacement state — for tool result budget enforcement (Phase E). */
  readonly contentReplacementState?: unknown

  /** Permission mode for this turn (e.g., 'default' | 'acceptEdits' | 'bypassPermissions'). */
  readonly permissionMode?: PermissionMode

  /** User-visible tool options (passed from profile). */
  readonly options: ToolOptions
}

export interface QueryTracking {
  chainId: string
  depth: number
}

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions'

export interface ToolOptions {
  /** All available tool definitions for this turn. */
  tools: ToolDef[]
  /** Whether MCP tools are available. */
  mcpClients?: ReadonlyArray<{ name: string }>
  /** Whether tool search (lazy MCP discovery) is enabled. */
  toolSearchEnabled?: boolean
}

export interface ToolDef {
  name: string
  description: string
  inputSchema?: unknown
  /** Runtime check: is this tool safe to run concurrently with others? */
  isConcurrencySafe?: (parsedInput: unknown) => boolean
  /** Risk level hint (read / write / risky). */
  riskLevel?: 'read' | 'write' | 'risky'
}

// ── Context modifier (tools can return this to affect subsequent tools) ──

/**
 * A function that transforms the ToolUseContext. Returned by tools
 * that need to change the execution environment for subsequent tools
 * in the same batch.
 *
 * Examples:
 *   - `setConfig({ key: 'API_URL', value: '...' })` returns a modifier
 *     that updates the environment for subsequent bash/network calls.
 *   - `setModel({ model: 'claude-sonnet-4-6' })` returns a modifier
 *     that changes the model for the next LLM iteration.
 */
export type ContextModifier = (ctx: ToolUseContext) => ToolUseContext

// ── Factory (creates a fresh context for each turn) ──

/**
 * Create a fresh ToolUseContext for a new turn.
 * The siblingAbortController is a child of the turn's abortController —
 * aborting siblings doesn't abort the turn, but aborting the turn aborts siblings.
 */
export function createToolUseContext(
  abortController: AbortController,
  tools: ToolDef[] = [],
  agentId?: string,
): ToolUseContext {
  const siblingAbortController = new AbortController()

  // Chain: parent abort → abort siblings too
  const parentSignal = abortController.signal
  if (parentSignal.aborted) {
    siblingAbortController.abort()
  } else {
    parentSignal.addEventListener('abort', () => {
      siblingAbortController.abort()
    }, { once: true })
  }

  const inProgress = new Set<string>()

  return {
    abortController,
    siblingAbortController,
    inProgressToolUseIDs: inProgress,
    setInProgressToolUseIDs: (fn) => {
      const next = fn(new Set(inProgress))
      inProgress.clear()
      for (const id of next) inProgress.add(id)
    },
    agentId,
    options: { tools },
  }
}

// ── Context modifier combinators ──

/** Identity modifier — no change. */
export const noopModifier: ContextModifier = (ctx) => ctx

/** Compose multiple modifiers left-to-right. */
export function composeModifiers(...modifiers: ContextModifier[]): ContextModifier {
  return (ctx) => modifiers.reduce((c, m) => m(c), ctx)
}

/** Apply a list of modifier batches (from multiple tools) sequentially. */
export function applyModifiers(
  ctx: ToolUseContext,
  modifierBatches: Array<ContextModifier[]>,
): ToolUseContext {
  let result = ctx
  for (const batch of modifierBatches) {
    for (const modifier of batch) {
      result = modifier(result)
    }
  }
  return result
}
