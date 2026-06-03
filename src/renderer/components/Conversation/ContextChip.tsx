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
                     bg-[var(--app-bg-active)] border border-[var(--app-border-muted)] text-[11px] text-[var(--app-text)]"
    >
      <span className="text-[var(--app-text-secondary)]">{ICON_MAP[chip.type]}</span>
      <span className="truncate max-w-[120px]">{chip.label}</span>
      <button onClick={onRemove} className="text-[var(--app-text-dim)] hover:text-[var(--app-text-secondary)]">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}
