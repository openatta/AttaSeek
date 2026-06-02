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
    <div className="flex-shrink-0 border-t border-neutral-800 px-4 py-3 bg-neutral-950">
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
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg
                       px-3 py-2 pr-8 text-sm text-neutral-200 placeholder-neutral-600
                       resize-none outline-none max-h-[40vh]
                       focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/30
                       transition-colors"
            placeholder="Message AttaSeek… (Enter to send, Shift+Enter for newline)"
            rows={Math.min(8, Math.max(2, value.split('\n').length))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                // Send logic — wired when agent integration is built
              }
            }}
          />
        </div>

        <div className="flex items-center gap-1">
          {isRunning ? (
            <button
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg
                         bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors"
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
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
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
        <span className="text-[10px] text-neutral-600">
          @file · @folder · @agent · @plugin
        </span>
        <span className="text-[10px] text-neutral-600 hidden sm:block">
          /plan · /review · /explain · /fix · /diff
        </span>
      </div>
    </div>
  )
}
