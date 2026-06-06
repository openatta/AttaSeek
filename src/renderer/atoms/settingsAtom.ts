import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export type SettingsSection =
  | 'general' | 'appearance' | 'model' | 'agent'
  | 'permissions' | 'memory' | 'keyboard' | 'notifications'

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; i18nKey: string }[] = [
  { id: 'general', label: 'General', i18nKey: 'settings.general' },
  { id: 'appearance', label: 'Appearance', i18nKey: 'settings.appearance' },
  { id: 'model', label: 'Model', i18nKey: 'settings.model' },
  { id: 'agent', label: 'Agent', i18nKey: 'settings.agent' },
  { id: 'permissions', label: 'Permissions', i18nKey: 'settings.permissions' },
  { id: 'memory', label: 'Memory', i18nKey: 'settings.memory' },
  { id: 'keyboard', label: 'Keyboard', i18nKey: 'settings.keyboard' },
  { id: 'notifications', label: 'Notifications', i18nKey: 'settings.notifications' },
]

export const settingsSectionAtom = atom<SettingsSection>('general')

export type PermissionMode = 'default' | 'auto' | 'trust'
export type ReasoningEffort = 'low' | 'medium' | 'high'

// All settings atoms persisted to localStorage (survive page switches + reloads)
// theme: use themeAtom from themeAtom.ts (already atomWithStorage with key 'attaseek-theme')
export const sandboxModeAtom = atomWithStorage<string>('attaseek-sandbox', 'workspace-write')
export const permissionModeAtom = atomWithStorage<PermissionMode>('attaseek-permission', 'default')
export const reasoningEffortAtom = atomWithStorage<ReasoningEffort>('attaseek-reasoning', 'medium')
export const personalityAtom = atomWithStorage<string>('attaseek-personality', 'pragmatic')
export const fastModeAtom = atomWithStorage<string>('attaseek-fastmode', 'off')
export const thinkingModeAtom = atomWithStorage<string>('attaseek-thinking', 'auto')
export const outputStyleAtom = atomWithStorage<string>('attaseek-output', 'default')
export const editorModeAtom = atomWithStorage<string>('attaseek-editor', 'normal')
export const languageAtom = atomWithStorage<string>('attaseek-language', 'en')
export const instructionsAtom = atomWithStorage<string>('attaseek-instructions', '')
