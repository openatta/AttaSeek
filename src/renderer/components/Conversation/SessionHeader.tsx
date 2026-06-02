import { Monitor, Info, PanelBottom } from 'lucide-react'
import ContextRing from './ContextRing'

export default function SessionHeader() {
  return (
    <div className="flex-shrink-0 h-[40px] flex items-center gap-3 px-4 border-b border-neutral-800 bg-neutral-950/80">
      {/* Left — editable session title */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-neutral-300 truncate">New Session</span>
      </div>

      {/* Center — context ring */}
      <div className="flex-1 flex justify-center">
        <ContextRing used={0} total={200000} />
      </div>

      {/* Right — three action buttons */}
      <div className="flex items-center gap-0.5">
        <button
          className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
          title="应用面板"
          aria-label="应用面板"
        >
          <Monitor className="w-4 h-4" />
        </button>
        <button
          className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
          title="环境信息"
          aria-label="环境信息"
        >
          <Info className="w-4 h-4" />
        </button>
        <button
          className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
          title="AI 输出区域"
          aria-label="AI 输出区域"
        >
          <PanelBottom className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
