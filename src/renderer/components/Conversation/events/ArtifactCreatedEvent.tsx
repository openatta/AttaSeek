import InlineArtifactPreview from '../InlineArtifactPreview'
import type { ArtifactCreatedPayload } from '../../../../shared/types/SessionEvent'
import type { ArtifactType } from '../../../../shared/types/Artifact'

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
