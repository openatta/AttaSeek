import type { TaskCompletedPayload } from '../../../core/types/SessionEvent'

interface Props { payload: TaskCompletedPayload }

export default function TaskCompletedEvent({ payload }: Props) {
  // Lightweight stats line — ChatGPT doesn't show a completion card, just ends naturally.
  // If you want stats, uncomment:
  // if (payload.duration > 0) return (
  //   <div className="py-1 text-[11px] text-[var(--app-text-dim)]">
  //     {payload.toolCallCount > 0 && <span>{payload.toolCallCount} tools · </span>}
  //     {Math.round(payload.duration / 1000)}s
  //   </div>
  // )
  return null
}
