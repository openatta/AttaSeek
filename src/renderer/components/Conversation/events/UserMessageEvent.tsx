import type { UserMessagePayload } from '../../../core/types/SessionEvent'
import { Copy, Check, Edit } from 'lucide-react'
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard'

interface Props { payload: UserMessagePayload; onEdit?: (text: string) => void }

export default function UserMessageEvent({ payload, onEdit }: Props) {
  const [copied, copy] = useCopyToClipboard()

  const handleCopy = () => copy(payload.content)

  return (
    <div className="py-2 flex justify-end">
      <div className="max-w-[85%]">
        <div className="bg-[var(--app-bg-active)] text-[var(--app-text)] rounded-2xl rounded-br-md px-4 py-3">
          <p className="text-base leading-relaxed whitespace-pre-wrap">{payload.content}</p>
        </div>
        <div className="flex justify-end gap-1 mt-1 opacity-0 hover:opacity-100 transition-opacity">
          <button onClick={handleCopy} className="p-1 rounded hover:bg-[var(--app-bg-hover)] text-[var(--app-text-dim)]" title="Copy">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {onEdit && (
            <button onClick={() => onEdit(payload.content)} className="p-1 rounded hover:bg-[var(--app-bg-hover)] text-[var(--app-text-dim)]" title="Edit">
              <Edit className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
