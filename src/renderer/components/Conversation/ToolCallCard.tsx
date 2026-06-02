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
      <div className="border border-neutral-700 rounded-lg bg-neutral-900/50 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
          <span className="text-xs text-neutral-500">🔧 {tool}</span>
          <span className="text-xs text-neutral-600 truncate flex-1">— {summary}</span>
          {onUndo && (
            <button
              onClick={onUndo}
              className="text-neutral-600 hover:text-neutral-400 transition-colors"
              title="撤销"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {expanded && (input || output) && (
          <div className="border-t border-neutral-700 px-3 py-2 text-xs text-neutral-400 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
            {input && <div className="text-neutral-600 mb-1">// Input:</div>}
            {input && <div>{input}</div>}
            {output && <div className="text-neutral-600 mt-2 mb-1">// Output:</div>}
            {output && <div>{output}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
