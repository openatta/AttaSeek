import { atom } from 'jotai'

export interface ContextChip {
  id: string
  type: 'file' | 'folder' | 'agent' | 'plugin'
  label: string
  path?: string
}

export const composerValueAtom = atom('')
export const composerChipsAtom = atom<ContextChip[]>([])
export const isAgentRunningAtom = atom(false)
