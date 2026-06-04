/**
 * CodeRenderer — renders code content with syntax highlighting.
 * MVP: plain text display. Future: Monaco Editor integration.
 */

import type { ArtifactRendererProps } from '../../registries/artifactRendererRegistry'

export default function CodeRenderer({ content, title }: ArtifactRendererProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--app-border)]">
        <h2 className="text-sm font-medium text-[var(--app-text-secondary)]">{title}</h2>
        <span className="text-xs text-[var(--app-text-tertiary)]">Code View</span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-sm font-mono text-[var(--app-text-primary)] whitespace-pre">
          <code>{content}</code>
        </pre>
      </div>
    </div>
  )
}
