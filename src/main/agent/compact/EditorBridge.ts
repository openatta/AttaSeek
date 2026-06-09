/**
 * EditorBridge — IDE/Editor integration interface reservation.
 *
 * This module defines the TypeScript interfaces for integrating AttaSeek's
 * agent with a code editor panel (Monaco-based right sidebar). The agent
 * can request the editor to open files, show diffs, get cursor selections,
 * and receive cursor/change events.
 *
 * **Current status**: INTERFACE RESERVATION ONLY. No implementation.
 * The implementing team should:
 *   1. Create `src/renderer/bridge/EditorBridgeImpl.ts` implementing this interface
 *   2. Wire it via IPC (main ↔ renderer contextBridge)
 *   3. Register with the ToolUseContext so tools like Edit/Read can use it
 *
 * ## Design rationale
 *
 * Mirrors Claude Code's LSP integration pattern (src/services/lsp/) where the
 * editor provides:
 *   - **Read path**: file content, cursor position, selection, diagnostics
 *   - **Write path**: open file, show diff, apply edit, reveal range
 *   - **Event path**: cursor change, document change, diagnostic change
 *
 * Unlike Claude Code's terminal-based approach, AttaSeek has a native editor
 * panel (Monaco) so the integration is tighter — no LSP server needed for
 * basic navigation; the editor panel handles syntax highlighting natively.
 * LSP diagnostics can be layered on top separately.
 */

// ── Core types ──

/** A 0-based range in a text document. */
export interface EditorRange {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

/** A file position (cursor location). */
export interface EditorPosition {
  line: number
  column: number
}

/** A text edit to apply. */
export interface EditorEdit {
  range: EditorRange
  newText: string
}

/** A file diff to display. */
export interface EditorDiff {
  filePath: string
  original: string
  modified: string
  label?: string
}

// ── Editor provider interface ──

/**
 * EditorBridge — the interface that the editor panel must implement.
 *
 * All methods are async (return Promises) to support IPC round-trips.
 * The agent calls these via the ToolUseContext during tool execution.
 */
export interface EditorBridge {
  // ── Navigation ──

  /**
   * Open a file in the editor panel at the given position.
   * If the file is already open, reveals the position.
   *
   * @param filePath — absolute path to the file
   * @param position — optional cursor position to navigate to
   * @param revealRange — optional range to reveal (scroll into view)
   */
  openFile(
    filePath: string,
    position?: EditorPosition,
    revealRange?: EditorRange,
  ): Promise<void>

  /**
   * Close a file tab in the editor panel.
   */
  closeFile(filePath: string): Promise<void>

  /**
   * Show a diff between original and modified content.
   * Used by the agent to present proposed edits for user review.
   */
  showDiff(diff: EditorDiff): Promise<void>

  /**
   * Close all open diff views.
   */
  closeAllDiffs(): Promise<void>

  // ── Read operations ──

  /**
   * Get the current cursor position in the active editor.
   * Returns undefined if no editor is active.
   */
  getCursorPosition(): Promise<EditorPosition | undefined>

  /**
   * Get the current text selection in the active editor.
   * Returns undefined if nothing is selected.
   */
  getSelection(): Promise<{ text: string; range: EditorRange } | undefined>

  /**
   * Get the full content of the file currently open in the editor.
   * Returns undefined if no editor is active.
   */
  getActiveFileContent(): Promise<string | undefined>

  /**
   * Get the path of the currently active file.
   */
  getActiveFilePath(): Promise<string | undefined>

  /**
   * Get all currently open file paths (tabs).
   */
  getOpenFiles(): Promise<string[]>

  // ── Write operations ──

  /**
   * Apply one or more text edits to the active file.
   * The editor should update its content and mark the file as dirty.
   */
  applyEdits(edits: EditorEdit[]): Promise<void>

  /**
   * Replace the entire content of the active file.
   */
  setFileContent(content: string): Promise<void>

  /**
   * Save the active file (if dirty).
   */
  saveActiveFile(): Promise<void>

  // ── Event subscriptions ──

  /**
   * Subscribe to cursor position changes.
   * Returns an unsubscribe function.
   *
   * @param callback — called with the new position on each cursor move
   */
  onCursorChange(
    callback: (position: EditorPosition, filePath: string) => void,
  ): Promise<() => void>

  /**
   * Subscribe to document content changes.
   * Returns an unsubscribe function.
   */
  onDocumentChange(
    callback: (filePath: string, content: string) => void,
  ): Promise<() => void>

  /**
   * Subscribe to file open/close events.
   * Returns an unsubscribe function.
   */
  onActiveFileChange(
    callback: (filePath: string | undefined) => void,
  ): Promise<() => void>
}

// ── No-op implementation (for when editor is not available) ──

/**
 * A no-op EditorBridge that silently does nothing.
 * Used as the default when no editor panel is available (e.g., headless mode).
 */
export const NOOP_EDITOR_BRIDGE: EditorBridge = {
  openFile: async () => {},
  closeFile: async () => {},
  showDiff: async () => {},
  closeAllDiffs: async () => {},
  getCursorPosition: async () => undefined,
  getSelection: async () => undefined,
  getActiveFileContent: async () => undefined,
  getActiveFilePath: async () => undefined,
  getOpenFiles: async () => [],
  applyEdits: async () => {},
  setFileContent: async () => {},
  saveActiveFile: async () => {},
  onCursorChange: async () => () => {},
  onDocumentChange: async () => () => {},
  onActiveFileChange: async () => () => {},
}

// ── Registry (for runtime injection) ──

let _registeredBridge: EditorBridge = NOOP_EDITOR_BRIDGE

/**
 * Register an EditorBridge implementation.
 * Called by the editor panel during initialization.
 */
export function registerEditorBridge(bridge: EditorBridge): void {
  _registeredBridge = bridge
}

/**
 * Get the currently registered EditorBridge.
 */
export function getEditorBridge(): EditorBridge {
  return _registeredBridge
}

/**
 * Reset to no-op (for testing).
 */
export function resetEditorBridge(): void {
  _registeredBridge = NOOP_EDITOR_BRIDGE
}
