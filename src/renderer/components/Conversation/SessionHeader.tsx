/**
 * Session header — fixed at the top of the Conversation panel.
 * Modeled after Codex Desktop's Session Header:
 *   Left: editable session title
 *   Center: context usage ring indicator
 *   Right: model selector + permission mode + app buttons (Term/Diff/Brow)
 */
export default function SessionHeader() {
  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-neutral-800 bg-neutral-950/80">
      {/* Left — editable session title */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-neutral-300 truncate">
          New Session
        </span>
      </div>

      {/* Center — spacer */}
      <div className="flex-1" />

      {/* Right — model selector placeholder */}
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span className="px-2 py-1 rounded border border-neutral-700 text-neutral-400">
          Opus 4.7 ▾
        </span>
        <span className="px-2 py-1 rounded border border-neutral-700 text-neutral-400">
          Auto ▾
        </span>
      </div>

      {/* App buttons (Terminal / Diff / Browser) */}
      <div className="flex items-center gap-0.5 ml-2">
        {['▶', '◉', '◉'].map((icon, i) => (
          <button
            key={i}
            className="w-6 h-6 flex items-center justify-center rounded text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
            title={['Terminal', 'Diff', 'Browser'][i]}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}
