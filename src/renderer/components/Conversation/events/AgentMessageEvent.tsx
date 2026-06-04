import type { AgentMessagePayload } from '../../../core/types/SessionEvent'

interface Props {
  payload: AgentMessagePayload
}

export default function AgentMessageEvent({ payload }: Props) {
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded-xl rounded-bl-md px-4 py-2 max-w-[80%]">
        {payload.reasoning && (
          <p className="text-[11px] text-[var(--app-text-dim)] mb-1 italic">{payload.reasoning}</p>
        )}
        <p className="text-sm text-[var(--app-text)]">{payload.content}</p>
      </div>
    </div>
  )
}
