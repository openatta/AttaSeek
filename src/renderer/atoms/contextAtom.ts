import { atom } from 'jotai'

export interface ContextUsage {
  used: number
  total: number
}

export const contextUsageAtom = atom<ContextUsage>({ used: 0, total: 200000 })
