import type { ToolCallFinishedPayload } from '../../../core/types/SessionEvent'

interface Props {
  payload: ToolCallFinishedPayload
}

export default function ToolCallFinishedEvent({ payload }: Props) {
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded-lg px-3 py-2 flex items-center gap-2">
        <span className="text-xs">{payload.status === 'success' ? '✅' : '❌'}</span>
        <span className="text-xs text-[var(--app-text-secondary)]">
          <code className="text-[var(--app-accent)]">{payload.toolName}</code> completed
        </span>
        <span className="text-[10px] text-[var(--app-text-dim)]">{Math.round(payload.duration)}ms</span>
      </div>
    </div>
  )
}
