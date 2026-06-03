import { useAtom } from 'jotai'
import { composerValueAtom, composerChipsAtom, isAgentRunningAtom } from '../../atoms/composerAtom'
import ContextChip from './ContextChip'
import ModelSelector from './ModelSelector'

export default function Composer() {
  const [value, setValue] = useAtom(composerValueAtom)
  const [chips, setChips] = useAtom(composerChipsAtom)
  const [isRunning] = useAtom(isAgentRunningAtom)

  const removeChip = (id: string) => setChips((prev) => prev.filter((c) => c.id !== id))

  return (
    <div className="flex-shrink-0 border-t border-[var(--app-border)] px-4 py-3 bg-[var(--app-bg)]">
      {/* Context chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {chips.map((chip) => (
            <ContextChip key={chip.id} chip={chip} onRemove={() => removeChip(chip.id)} />
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded-lg
                       px-3 py-2 pr-8 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-dim)]
                       resize-none outline-none max-h-[40vh]
                       focus:border-[var(--app-accent)] focus:ring-1 focus:ring-[var(--app-accent-border)]
                       transition-colors"
            placeholder="Message AttaSeek… (Enter to send, Shift+Enter for newline)"
            rows={Math.min(8, Math.max(2, value.split('\n').length))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
              }
            }}
          />
        </div>

        <div className="flex items-center gap-1">
          {isRunning ? (
            <button
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg
                         bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
              title="Stop"
              aria-label="Stop"
            >
              <span className="text-sm">■</span>
            </button>
          ) : (
            <button
              className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-colors
                ${
                  value.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-[var(--app-bg-active)] text-[var(--app-text-dim)] cursor-not-allowed'
                }`}
              disabled={!value.trim()}
              title="Send"
              aria-label="Send"
            >
              <span className="text-sm">→</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mt-1.5 px-0.5">
        <ModelSelector />
        <div className="flex-1" />
        <span className="text-[10px] text-[var(--app-text-dim)]">
          @file · @folder · @agent · @plugin
        </span>
        <span className="text-[10px] text-[var(--app-text-dim)] hidden sm:block">
          /plan · /review · /explain · /fix · /diff
        </span>
      </div>
    </div>
  )
}
