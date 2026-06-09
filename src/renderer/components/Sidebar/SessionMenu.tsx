import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from '../../i18n'
import type { SessionInfo } from '../../../shared/types/AgentTask'

interface Props {
  session: SessionInfo
  onRename: () => void
  onDelete: () => void
}

export default function SessionMenu({ session, onRename, onDelete }: Props) {
  const { t } = useTranslation()
  return (
    <div className="absolute right-3 top-10 z-[100] bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg py-1 min-w-[130px]">
      <button onClick={onRename}
        className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] flex items-center gap-2">
        <Pencil className="w-3 h-3" /> {t('chats.rename')}
      </button>
      <button onClick={onDelete}
        className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-[var(--app-bg-hover)] flex items-center gap-2">
        <Trash2 className="w-3 h-3" /> {t('chats.delete')}
      </button>
    </div>
  )
}
