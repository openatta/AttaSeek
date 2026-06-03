import { useAtom } from 'jotai'
import {
  composerValueAtom,
  composerChipsAtom,
  isAgentRunningAtom
} from '../../atoms/composerAtom'
import {
  permissionModeAtom,
  reasoningEffortAtom,
  type PermissionMode,
  type ReasoningEffort
} from '../../atoms/composerSettingsAtom'
import ContextChip from './ContextChip'
import ModelSelector from './ModelSelector'
import { Plus, Mic } from 'lucide-react'

const PERMISSION_LABELS: Record<PermissionMode, string> = {
  default: 'Default Review',
  auto: 'Auto Review',
  trust: 'Full Trust'
}

const REASONING_LABELS: Record<ReasoningEffort, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
}

export default function Composer() {
  const [value, setValue] = useAtom(composerValueAtom)
  const [chips, setChips] = useAtom(composerChipsAtom)
  const [isRunning] = useAtom(isAgentRunningAtom)
  const [permissionMode, setPermissionMode] = useAtom(permissionModeAtom)
  const [reasoningEffort, setReasoningEffort] = useAtom(reasoningEffortAtom)

  const removeChip = (id: string) => setChips((prev) => prev.filter((c) => c.id !== id))

  const cyclePermission = () => {
    const modes: PermissionMode[] = ['default', 'auto', 'trust']
    const idx = modes.indexOf(permissionMode)
    setPermissionMode(modes[(idx + 1) % modes.length])
  }

  const cycleReasoning = () => {
    const efforts: ReasoningEffort[] = ['low', 'medium', 'high']
    const idx = efforts.indexOf(reasoningEffort)
    setReasoningEffort(efforts[(idx + 1) % efforts.length])
  }

  return (
    <div className="flex-shrink-0 px-4 py-3 bg-[var(--app-bg)]">
      {/* Context chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {chips.map((chip) => (
            <ContextChip key={chip.id} chip={chip} onRemove={() => removeChip(chip.id)} />
          ))}
        </div>
      )}

      {/* Input textarea — no top border, natural spacing from messages */}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full bg-transparent text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-dim)]
                   resize-none outline-none
                   focus:ring-0"
        placeholder="Message AttaSeek…"
        rows={Math.min(8, Math.max(2, value.split('\n').length))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
          }
        }}
      />

      {/* Toolbar — CODEX style: + / permission / reasoning / mic / model / ⌘Enter */}
      <div className="flex items-center gap-1.5 mt-2">
        {/* + Add context button */}
        <button
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
          title="Add context"
          aria-label="Add context"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Permission mode tag */}
        <button
          onClick={cyclePermission}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--app-border)] text-[11px] text-[var(--app-text-secondary)] cursor-pointer hover:border-[var(--app-text-dim)] hover:text-[var(--app-text)] transition-colors select-none"
        >
          {PERMISSION_LABELS[permissionMode]} ▾
        </button>

        {/* Reasoning effort tag */}
        <button
          onClick={cycleReasoning}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--app-border)] text-[11px] text-[var(--app-text-secondary)] cursor-pointer hover:border-[var(--app-text-dim)] hover:text-[var(--app-text)] transition-colors select-none"
        >
          Reasoning ▾
        </button>

        {/* Mic button */}
        <button
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
          title="Voice input"
          aria-label="Voice input"
        >
          <Mic className="w-3.5 h-3.5" />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Model selector */}
        <ModelSelector />

        {/* Send button or stop button */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--app-text-dim)] hidden sm:block">⌘Enter</span>
          {isRunning ? (
            <button
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md
                         bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
              title="Stop"
              aria-label="Stop"
            >
              <span className="text-xs">■</span>
            </button>
          ) : (
            <button
              className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors
                ${
                  value.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-[var(--app-bg-active)] text-[var(--app-text-dim)] cursor-not-allowed'
                }`}
              disabled={!value.trim()}
              title="Send"
              aria-label="Send"
            >
              <span className="text-xs">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
