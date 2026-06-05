/**
 * SvgRenderer — renders SVG content inline with basic sanitization.
 * Strips event handler attributes and script elements before rendering.
 */

import { useMemo } from 'react'
import type { ArtifactRendererProps } from '../../registries/artifactRendererRegistry'

/** Remove script tags and event handler attributes from SVG content */
function sanitizeSvg(svg: string): string {
  return svg
    // Remove <script>...</script> blocks
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove on* event handler attributes (onclick, onload, onerror, etc.)
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    // Remove javascript: URLs
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
}

export default function SvgRenderer({ content, title }: ArtifactRendererProps) {
  const sanitized = useMemo(() => sanitizeSvg(content), [content])

  return (
    <div className="p-4 h-full overflow-auto">
      <h2 className="text-lg font-semibold mb-3 text-[var(--app-text-primary)]">{title}</h2>
      <div
        className="flex items-center justify-center bg-[var(--app-bg-secondary)] rounded-lg p-4"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </div>
  )
}
