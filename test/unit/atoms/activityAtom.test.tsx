import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAtom } from 'jotai'
import { activeActivityAtom, type Activity } from '@/atoms/activityAtom'
import { Provider } from 'jotai'

function wrapper({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>
}

function useActivityAtom() {
  return renderHook(() => useAtom(activeActivityAtom), { wrapper })
}

const ALL_ACTIVITIES: Activity[] = [
  'home',
  'chat',
  'projects',
  'search',
  'automation',
  'plugin',
  'settings'
]

describe('activityAtom', () => {
  it('should default to "home"', () => {
    const { result } = useActivityAtom()
    expect(result.current[0]).toBe('home')
  })

  it.each(ALL_ACTIVITIES)('should switch activity to %s', (target) => {
    const { result } = useActivityAtom()
    act(() => result.current[1](target))
    expect(result.current[0]).toBe(target)
  })

  it('should persist the last set value', () => {
    const { result } = useActivityAtom()
    act(() => result.current[1]('settings'))
    act(() => result.current[1]('search'))
    act(() => result.current[1]('home'))
    expect(result.current[0]).toBe('home')
  })
})
