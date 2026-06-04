import type { ArtifactCreatedPayload } from '../../../core/types/SessionEvent'

interface Props {
  payload: ArtifactCreatedPayload
}

export default function ArtifactCreatedEvent({ payload }: Props) {
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--app-bg-inset)] border border-green-500/30 rounded-xl px-4 py-2 max-w-[80%]">
        <p className="text-xs font-semibold text-green-400 mb-1">📄 Artifact: {payload.title}</p>
        <p className="text-[11px] text-[var(--app-text-secondary)]">{payload.summary}</p>
      </div>
    </div>
  )
}
