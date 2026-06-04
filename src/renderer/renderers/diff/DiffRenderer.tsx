/**
 * DiffRenderer — renders unified diff content.
 * MVP: color-coded addition/removal lines. Future: Monaco Diff Editor.
 */

import { useMemo } from 'react'
import type { ArtifactRendererProps } from '../../registries/artifactRendererRegistry'

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header'
  content: string
}

function parseDiff(content: string): DiffLine[] {
  return content.split('\n').map((line) => {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      return { type: 'header', content: line }
    }
    if (line.startsWith('+')) {
      return { type: 'add', content: line }
    }
    if (line.startsWith('-')) {
      return { type: 'remove', content: line }
    }
    return { type: 'context', content: line }
  })
}

export default function DiffRenderer({ content, title }: ArtifactRendererProps) {
  const lines = useMemo(() => parseDiff(content), [content])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-[var(--app-border)]">
        <h2 className="text-sm font-medium text-[var(--app-text-secondary)]">{title}</h2>
      </div>
      <div className="flex-1 overflow-auto font-mono text-xs">
        {lines.map((line, i) => {
          let bg = 'transparent'
          if (line.type === 'add') bg = 'rgba(0, 200, 100, 0.1)'
          if (line.type === 'remove') bg = 'rgba(255, 80, 80, 0.1)'
          if (line.type === 'header') bg = 'rgba(100, 150, 255, 0.1)'

          return (
            <div
              key={i}
              className="px-4 py-0.5 whitespace-pre"
              style={{ background: bg, color: 'var(--app-text-secondary)' }}
            >
              {line.content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
