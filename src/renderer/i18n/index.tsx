import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { en } from './locales/en'
import { zh } from './locales/zh'

export type Locale = 'en' | 'zh'
const locales: Record<Locale, Record<string, string>> = { en, zh }

interface I18nContextType { locale: Locale; t: (key: string, fallback?: string) => string; setLocale: (l: Locale) => void }
const I18nContext = createContext<I18nContextType>({ locale: 'en', t: (k, f) => f || k, setLocale: () => {} })

export function I18nProvider({ children, initialLocale = 'en' }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const t = useCallback((key: string, fallback?: string) => {
    const dict = locales[locale]
    return dict[key] || locales.en[key] || fallback || key
  }, [locale])
  return <I18nContext.Provider value={{ locale, t, setLocale }}>{children}</I18nContext.Provider>
}

export function useTranslation() { return useContext(I18nContext) }
