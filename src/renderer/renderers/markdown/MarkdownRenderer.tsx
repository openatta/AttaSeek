/**
 * MarkdownRenderer — renders markdown content as HTML.
 * MVP: simple text display. Future: marked/react-markdown integration.
 */

import type { ArtifactRendererProps } from '../../registries/artifactRendererRegistry'

export default function MarkdownRenderer({ content, title, editable }: ArtifactRendererProps) {
  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-semibold mb-3 text-[var(--app-text-primary)]">{title}</h2>
      <div className="prose prose-sm max-w-none text-[var(--app-text-secondary)] whitespace-pre-wrap font-mono text-sm">
        {content}
      </div>
      {editable && (
        <div className="mt-3 text-xs text-[var(--app-text-tertiary)]">
          Markdown renderer — edit support coming soon
        </div>
      )}
    </div>
  )
}
