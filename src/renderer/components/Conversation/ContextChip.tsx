import { X } from 'lucide-react'
import type { ContextChip as ChipType } from '../../atoms/composerAtom'

interface Props {
  chip: ChipType
  onRemove: () => void
}

const ICON_MAP: Record<ChipType['type'], string> = {
  file: '📄',
  folder: '📂',
  agent: '🤖',
  plugin: '🧩'
}

export default function ContextChip({ chip, onRemove }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                     bg-neutral-800 border border-neutral-700 text-[11px] text-neutral-300"
    >
      <span className="text-neutral-500">{ICON_MAP[chip.type]}</span>
      <span className="truncate max-w-[120px]">{chip.label}</span>
      <button onClick={onRemove} className="text-neutral-600 hover:text-neutral-400">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}
