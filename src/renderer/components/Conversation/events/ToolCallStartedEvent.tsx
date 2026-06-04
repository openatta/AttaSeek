import type { ToolCallStartedPayload } from '../../../core/types/SessionEvent'

interface Props {
  payload: ToolCallStartedPayload
}

export default function ToolCallStartedEvent({ payload }: Props) {
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded-lg px-3 py-2 flex items-center gap-2">
        <span className="text-xs">🔧</span>
        <span className="text-xs text-[var(--app-text-secondary)]">
          Running <code className="text-[var(--app-accent)]">{payload.toolName}</code>
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            payload.riskLevel === 'risky'
              ? 'bg-red-500/10 text-red-400'
              : payload.riskLevel === 'write'
                ? 'bg-yellow-500/10 text-yellow-400'
                : 'bg-blue-500/10 text-blue-400'
          }`}
        >
          {payload.riskLevel}
        </span>
        <span className="ml-auto text-xs animate-pulse">⏳</span>
      </div>
    </div>
  )
}
