import { useState } from 'react'
import type { ToolCallStartedPayload } from '../../../../shared/types/SessionEvent'

interface Props { payload: ToolCallStartedPayload }

export default function ToolCallStartedEvent({ payload }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="py-0.5">
      <span onClick={() => setExpanded(!expanded)} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--app-text-dim)] hover:text-[var(--app-text-secondary)] cursor-pointer transition-colors">
        <span className="opacity-60">{expanded ? '▾' : '▸'}</span>
        <span>{payload.toolName.replace(/_/g, ' ')}</span>
      </span>
      {expanded && (
        <div className="mt-1 ml-5 p-2 rounded border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[11px] max-h-40 overflow-y-auto">
          <pre className="text-[var(--app-text-dim)] whitespace-pre-wrap font-mono">{JSON.stringify(payload.input, null, 2).slice(0, 300)}</pre>
        </div>
      )}
    </div>
  )
}
