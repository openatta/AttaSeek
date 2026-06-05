import { useState } from 'react'
import { ChevronDown, ChevronUp, Brain } from 'lucide-react'

export default function ThinkingCard({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="my-2">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-xs text-[var(--app-text-dim)] hover:text-[var(--app-text-secondary)] transition-colors">
        <Brain className="w-3.5 h-3.5" />
        <span>Thought for a few seconds</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {expanded && (
        <div className="mt-2 p-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-xs text-[var(--app-text-dim)] whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
          {content}
        </div>
      )}
    </div>
  )
}
