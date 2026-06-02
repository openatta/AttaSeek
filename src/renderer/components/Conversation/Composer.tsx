/**
 * Input area fixed at the bottom of the Conversation panel.
 * - Multi-line auto-expand (max 40% panel height)
 * - Enter to send, Shift+Enter for newline
 * - @ mentions: @file / @folder / @agent / @plugin
 * - / commands: /plan /review /explain /fix /diff
 * - Context chips appear above the input
 */
export default function Composer() {
  return (
    <div className="flex-shrink-0 border-t border-neutral-800 px-4 py-3 bg-neutral-950">
      {/* Context chips (placeholder) */}
      <div className="flex items-center gap-1.5 mb-2 min-h-0">
        {/* Chips would appear here */}
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                       text-neutral-200 placeholder-neutral-600 resize-none outline-none
                       focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/30
                       transition-colors"
            placeholder="Message AttaSeek… (Enter to send, Shift+Enter for newline)"
            rows={2}
            disabled
          />
        </div>

        <button
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg
                     bg-neutral-800 text-neutral-500 cursor-not-allowed transition-colors"
          disabled
          title="Send"
        >
          →
        </button>
      </div>

      {/* Hint row */}
      <div className="flex items-center gap-3 mt-1.5 px-0.5">
        <span className="text-[10px] text-neutral-600">
          @file · @folder · @agent · @plugin
        </span>
        <span className="text-[10px] text-neutral-600">
          /plan · /review · /explain · /fix · /diff
        </span>
      </div>
    </div>
  )
}
