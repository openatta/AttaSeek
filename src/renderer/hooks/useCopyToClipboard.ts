import { useState, useCallback, useEffect, useRef } from 'react'

/** Shared clipboard utility — returns [copied, copy] tuple. */
export function useCopyToClipboard(resetMs: number = 2000): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      if (!mountedRef.current) return
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) setCopied(false)
        timerRef.current = null
      }, resetMs)
    }).catch((e) => {
      console.warn('[Clipboard] copy failed:', e instanceof Error ? e.message : String(e))
    })
  }, [resetMs])

  return [copied, copy]
}
