import { atom } from 'jotai'

export type SettingsSection =
  | 'general'
  | 'profile'
  | 'appearance'
  | 'configuration'
  | 'personalization'
  | 'keyboard'
  | 'notifications'
  | 'agent'
  | 'git'
  | 'integrations'

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'profile', label: 'Profile' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'personalization', label: 'Personalization' },
  { id: 'keyboard', label: 'Keyboard Shortcuts' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'agent', label: 'Agent Config' },
  { id: 'git', label: 'Git' },
  { id: 'integrations', label: 'Integrations' }
]

export const settingsSectionAtom = atom<SettingsSection>('general')
