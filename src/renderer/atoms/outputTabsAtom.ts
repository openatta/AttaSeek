import { atom } from 'jotai'

export type OutputTabType = 'browser' | 'files' | 'terminal' | 'review'

export interface OutputTab {
  id: string
  type: OutputTabType
  label: string
}

export const outputTabsAtom = atom<OutputTab[]>([])
export const activeOutputTabAtom = atom<string | null>(null)
export const outputAreaVisibleAtom = atom(true)
