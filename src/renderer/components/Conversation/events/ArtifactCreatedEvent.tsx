import InlineArtifactPreview from '../InlineArtifactPreview'
import type { ArtifactCreatedPayload } from '../../../core/types/SessionEvent'
import type { ArtifactType } from '../../../core/types/Artifact'

interface Props {
  payload: ArtifactCreatedPayload
}

export default function ArtifactCreatedEvent({ payload }: Props) {
  return (
    <InlineArtifactPreview
      artifactId={payload.artifactId}
      type={payload.type as ArtifactType}
      title={payload.title}
      summary={payload.summary}
    />
  )
}
