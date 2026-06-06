import { useEffect, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { activeActivityAtom, type Activity } from '../atoms/activityAtom'

/**
 * Restores last activity on startup and persists current activity changes.
 * Skips persist until the initial restore completes to avoid overwriting stored value.
 */
export function useActivityPersistence(): void {
  const activeActivity = useAtomValue(activeActivityAtom)
  const setActiveActivity = useSetAtom(activeActivityAtom)
  const restoredRef = useRef(false)

  // Restore last activity on startup
  useEffect(() => {
    if (!window.api?.app) {
      restoredRef.current = true
      return
    }
    ;(async () => {
      try {
        const result = await window.api.app.getState('lastActivity')
        if (result.success && result.value) {
          setActiveActivity(result.value as Activity)
        }
      } catch { /* best-effort restore */ }
      finally { restoredRef.current = true }
    })()
  }, [])

  // Persist current activity on change — skipped until initial restore completes
  useEffect(() => {
    if (!restoredRef.current) return
    window.api?.app?.setState('lastActivity', activeActivity).catch(() => {})
  }, [activeActivity])
}
