/**
 * SvgRenderer — renders SVG content inline.
 */

import type { ArtifactRendererProps } from '../../registries/artifactRendererRegistry'

export default function SvgRenderer({ content, title }: ArtifactRendererProps) {
  return (
    <div className="p-4 h-full overflow-auto">
      <h2 className="text-lg font-semibold mb-3 text-[var(--app-text-primary)]">{title}</h2>
      <div
        className="flex items-center justify-center bg-[var(--app-bg-secondary)] rounded-lg p-4"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  )
}
