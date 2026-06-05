import { useSetAtom } from 'jotai'
import { settingsSectionAtom } from '../../atoms/settingsAtom'
import { activeActivityAtom, type Activity } from '../../atoms/activityAtom'
import { AlertTriangle, ExternalLink } from 'lucide-react'

export default function NoModelPrompt() {
  const setSettingsSection = useSetAtom(settingsSectionAtom)
  const setActivity = useSetAtom(activeActivityAtom)

  const handleOpenSettings = () => {
    setSettingsSection('model')
    setActivity('settings' as Activity)
  }

  return (
    <div className="flex justify-center">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 max-w-[85%] text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <p className="text-xs font-semibold text-amber-400">No model configured</p>
        </div>
        <p className="text-xs text-[var(--app-text-secondary)] mb-2">
          You need to configure at least one LLM provider before the agent can respond.
        </p>
        <button
          onClick={handleOpenSettings}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] bg-[var(--app-accent)] text-white hover:opacity-90 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Open Model Settings
        </button>
      </div>
    </div>
  )
}
