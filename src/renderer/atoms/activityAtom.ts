import { atom } from 'jotai'

export type Activity = 'home' | 'chat' | 'projects' | 'search' | 'automation' | 'plugin' | 'settings'

export const activeActivityAtom = atom<Activity>('chat')
