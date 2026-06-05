import { useAtom } from 'jotai'
import { settingsSectionAtom } from '../../atoms/settingsAtom'
import GeneralSettings from './pages/GeneralSettings'
import ProfileSettings from './pages/ProfileSettings'
import AppearanceSettings from './pages/AppearanceSettings'
import ConfigurationSettings from './pages/ConfigurationSettings'
import PersonalizationSettings from './pages/PersonalizationSettings'
import KeyboardSettings from './pages/KeyboardSettings'
import NotificationsSettings from './pages/NotificationsSettings'
import AgentSettings from './pages/AgentSettings'
import GitSettings from './pages/GitSettings'
import IntegrationsSettings from './pages/IntegrationsSettings'
import PermissionsSettings from './pages/PermissionsSettings'
import MemorySettings from './pages/MemorySettings'
import AuditSettings from './pages/AuditSettings'
import ModelSettings from './pages/ModelSettings'

const PAGE_MAP: Record<string, React.ComponentType> = {
  general: GeneralSettings,
  profile: ProfileSettings,
  appearance: AppearanceSettings,
  configuration: ConfigurationSettings,
  model: ModelSettings,
  personalization: PersonalizationSettings,
  keyboard: KeyboardSettings,
  notifications: NotificationsSettings,
  agent: AgentSettings,
  git: GitSettings,
  integrations: IntegrationsSettings,
  permissions: PermissionsSettings,
  memory: MemorySettings,
  audit: AuditSettings,
}

export default function Settings() {
  const [section] = useAtom(settingsSectionAtom)
  const Page = PAGE_MAP[section] || GeneralSettings

  return (
    <div className="flex-1 min-w-0 overflow-y-auto px-6 py-6">
      <div className="max-w-2xl">
        <Page />
      </div>
    </div>
  )
}
