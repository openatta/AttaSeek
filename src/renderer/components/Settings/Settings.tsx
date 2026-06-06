import { useAtom } from 'jotai'
import { settingsSectionAtom } from '../../atoms/settingsAtom'
import GeneralSettings from './pages/GeneralSettings'
import AppearanceSettings from './pages/AppearanceSettings'
import AgentSettings from './pages/AgentSettings'
import ModelSettings from './pages/ModelSettings'
import PermissionsSettings from './pages/PermissionsSettings'
import MemorySettings from './pages/MemorySettings'
import NotificationsSettings from './pages/NotificationsSettings'
import KeyboardSettings from './pages/KeyboardSettings'

const PAGE_MAP: Record<string, React.ComponentType> = {
  general: GeneralSettings,
  appearance: AppearanceSettings,
  model: ModelSettings,
  agent: AgentSettings,
  permissions: PermissionsSettings,
  memory: MemorySettings,
  keyboard: KeyboardSettings,
  notifications: NotificationsSettings,
}

export default function Settings() {
  const [section] = useAtom(settingsSectionAtom)
  const Page = PAGE_MAP[section] || GeneralSettings

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="h-[40px]" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
      <div className="px-6 py-6" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="max-w-2xl mx-auto">
          <Page />
        </div>
      </div>
    </div>
  )
}
