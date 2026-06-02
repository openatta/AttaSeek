import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export type Theme = 'dark' | 'light' | 'system'

export const themeAtom = atomWithStorage<Theme>('attaseek-theme', 'dark')
