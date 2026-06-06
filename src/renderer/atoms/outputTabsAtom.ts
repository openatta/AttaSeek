import { atom } from 'jotai'
import type { ArtifactType } from '../../shared/types/Artifact'

/** Output tabs can be artifact views or built-in panels. */
export type OutputTabType = ArtifactType | 'review'

export interface OutputTab {
  id: string
  type: OutputTabType
  label: string
}

export const outputTabsAtom = atom<OutputTab[]>([])
export const activeOutputTabAtom = atom<string | null>(null)
export const outputAreaVisibleAtom = atom(false)
export const outputFullscreenAtom = atom(false)
