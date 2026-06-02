/**
 * Artifact panel — displays agent-produced content in tabs.
 * Tabs: Code / Diff / Preview / Terminal / Browser / Diagram / Report / Data
 *
 * Title bar:
 *   Left: tab bar (draggable, sortable, closeable)
 *   Right: [⤢ expand] [✕ hide]
 *
 * Content area: renders the active tab's content
 */
export default function Artifact() {
  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Title bar */}
      <div className="flex-shrink-0 flex items-center border-b border-neutral-800 bg-neutral-950/80">
        {/* Tab area — placeholder */}
        <div className="flex items-center flex-1 min-w-0 px-2 py-1">
          <span className="text-xs text-neutral-600 px-2">
            No files open
          </span>
        </div>

        {/* Expand / Hide buttons */}
        <div className="flex items-center flex-shrink-0 mr-1">
          <button
            className="w-6 h-6 flex items-center justify-center rounded text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
            title="Expand panel"
          >
            ⤢
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center rounded text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
            title="Hide panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-neutral-800/40 flex items-center justify-center">
            <span className="text-lg text-neutral-600">⊞</span>
          </div>
          <p className="text-xs text-neutral-600">
            Artifacts appear here — code, diffs, previews, and more
          </p>
        </div>
      </div>
    </div>
  )
}
