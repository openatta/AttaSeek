import type { TaskCompletedPayload } from '../../../core/types/SessionEvent'

interface Props {
  payload: TaskCompletedPayload
}

export default function TaskCompletedEvent({ payload }: Props) {
  return (
    <div className="flex justify-center">
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2 text-center">
        <p className="text-xs text-green-400">
          ✓ Task completed • {payload.toolCallCount} tools • {payload.artifactCount} artifacts •{' '}
          {Math.round(payload.duration / 1000)}s
        </p>
      </div>
    </div>
  )
}
