import type { TaskFailedPayload } from '../../../core/types/SessionEvent'

interface Props {
  payload: TaskFailedPayload
}

export default function TaskFailedEvent({ payload }: Props) {
  return (
    <div className="flex justify-center">
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-center">
        <p className="text-xs text-red-400">✗ Failed: {payload.error}</p>
      </div>
    </div>
  )
}
