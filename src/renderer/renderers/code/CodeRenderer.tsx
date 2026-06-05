import { useState } from 'react'
import type { ArtifactRendererProps } from '../../registries/artifactRendererRegistry'
import { Copy, Check } from 'lucide-react'

export default function CodeRenderer({ content, title }: ArtifactRendererProps) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--app-border)]">
        <h2 className="text-sm font-medium text-[var(--app-text-secondary)]">{title}</h2>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-[var(--app-text-tertiary)] hover:text-[var(--app-text)] transition-colors p-1 rounded hover:bg-[var(--app-bg-hover)]">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-sm font-mono text-[var(--app-text-primary)] whitespace-pre"><code>{content}</code></pre>
      </div>
    </div>
  )
}
