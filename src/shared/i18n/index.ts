/**
 * Shared i18n — lightweight translation function usable from both
 * main and renderer processes (no React dependency).
 *
 * Usage:
 *   import { t, setLocale } from '../../shared/i18n'
 *   const label = t('tray.hideWindow')                     // uses current locale
 *   const label = t('tray.quitWithTasks', { count: 3 })    // with interpolation
 */

import { zh, en, type Locale } from './messages'

let currentLocale: Locale = 'zh'

/** Set the active locale. Call once at startup from persisted settings. */
export function setLocale(locale: Locale): void {
  currentLocale = locale
}

/** Get the current locale. */
export function getLocale(): Locale {
  return currentLocale
}

/** Translate a key with optional interpolation params.
 *  Falls back to the key itself if no translation is found. */
export function t(key: string, params?: Record<string, string | number>): string {
  const messages = currentLocale === 'en' ? en : zh
  let text = messages[key] ?? key

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}
