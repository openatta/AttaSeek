import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface AgentPlanCardProps {
  summary: string
  steps: string[]
}

export default function AgentPlanCard({ summary, steps }: AgentPlanCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="px-4 py-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {summary}
      </button>
      {expanded && (
        <div className="mt-2 ml-5 space-y-1">
          {steps.map((s, i) => (
            <div key={i} className="text-xs text-neutral-400">
              {i + 1}. {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
