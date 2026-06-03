import { atom } from 'jotai'

export type PermissionMode = 'default' | 'auto' | 'trust'
export type ReasoningEffort = 'low' | 'medium' | 'high'

export const permissionModeAtom = atom<PermissionMode>('default')
export const reasoningEffortAtom = atom<ReasoningEffort>('medium')
