import { useState } from 'react'
import { ChevronDown, ChevronRight, Undo2 } from 'lucide-react'

interface ToolCallCardProps {
  tool: string
  summary: string
  input?: string
  output?: string
  onUndo?: () => void
}

export default function ToolCallCard({
  tool,
  summary,
  input,
  output,
  onUndo
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="px-4 py-1">
      <div className="border border-[var(--app-border-muted)] rounded-lg bg-[var(--app-bg-inset)] overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[var(--app-text-secondary)] hover:text-[var(--app-text)] transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
          <span className="text-xs text-[var(--app-text-secondary)]">🔧 {tool}</span>
          <span className="text-xs text-[var(--app-text-dim)] truncate flex-1">— {summary}</span>
          {onUndo && (
            <button
              onClick={onUndo}
              className="text-[var(--app-text-dim)] hover:text-[var(--app-text-secondary)] transition-colors"
              title="撤销"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {expanded && (input || output) && (
          <div className="border-t border-[var(--app-border-muted)] px-3 py-2 text-xs text-[var(--app-text-secondary)] font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
            {input && <div className="text-[var(--app-text-dim)] mb-1">// Input:</div>}
            {input && <div>{input}</div>}
            {output && <div className="text-[var(--app-text-dim)] mt-2 mb-1">// Output:</div>}
            {output && <div>{output}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
