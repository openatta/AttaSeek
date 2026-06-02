import { useAtom } from 'jotai'
import { useEffect, type ReactNode } from 'react'
import { themeAtom, type Theme } from '../atoms/themeAtom'

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useAtom(themeAtom)

  // Apply theme to document root
  useEffect(() => {
    const resolved = resolveTheme(theme)
    document.documentElement.dataset.theme = resolved
  }, [theme])

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.dataset.theme = e.matches ? 'dark' : 'light'
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return <>{children}</>
}
