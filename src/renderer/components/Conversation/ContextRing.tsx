interface ContextRingProps {
  used: number
  total: number
}

export default function ContextRing({ used, total }: ContextRingProps) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0
  const radius = 10
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  const color = pct > 95 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#3b82f6'

  return (
    <div className="flex items-center gap-1.5 group cursor-default" title="上下文用量">
      <svg width={24} height={24} viewBox="0 0 24 24" className="-rotate-90">
        <circle cx="12" cy="12" r={radius} fill="none" stroke="#333" strokeWidth="2" />
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
          opacity={used > 0 ? 1 : 0}
        />
      </svg>
      <span className="text-[11px] text-neutral-500 tabular-nums">{pct}%</span>
    </div>
  )
}
