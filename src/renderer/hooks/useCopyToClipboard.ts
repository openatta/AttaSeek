import { useState, useCallback } from 'react'

/** Shared clipboard utility — returns [copied, copy] tuple. */
export function useCopyToClipboard(resetMs: number = 2000): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false)

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), resetMs)
    }).catch((e) => {
      console.warn('[Clipboard] copy failed:', e instanceof Error ? e.message : String(e))
    })
  }, [resetMs])

  return [copied, copy]
}
