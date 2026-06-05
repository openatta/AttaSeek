import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  message: string
  details?: string
}

export default function ErrorDetails({ message, details }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="text-[10px]">
      <span className="text-red-400">{message}</span>
      {details && (
        <>
          {' '}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[var(--app-text-dim)] hover:text-[var(--app-text)] underline"
          >
            {expanded ? 'Hide' : 'Details'} {expanded ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
          </button>
          {expanded && (
            <pre className="mt-1 p-2 rounded bg-[var(--app-bg-inset)] border border-[var(--app-border)] text-[var(--app-text-dim)] whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
              {details.slice(0, 500)}
            </pre>
          )}
        </>
      )}
    </div>
  )
}
