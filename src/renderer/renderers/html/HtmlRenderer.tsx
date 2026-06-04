/**
 * HtmlRenderer — renders HTML content in a sandboxed iframe.
 */

import { useRef, useEffect } from 'react'
import type { ArtifactRendererProps } from '../../registries/artifactRendererRegistry'

export default function HtmlRenderer({ content, title }: ArtifactRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return
    doc.open()
    doc.write(content)
    doc.close()
  }, [content])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 text-sm font-medium text-[var(--app-text-secondary)] border-b border-[var(--app-border)]">
        {title}
      </div>
      <iframe
        ref={iframeRef}
        className="flex-1 w-full border-0"
        sandbox="allow-scripts"
        title={title}
      />
    </div>
  )
}
