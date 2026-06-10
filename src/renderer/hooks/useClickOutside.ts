/**
 * useClickOutside — detects clicks/touches outside a given element.
 *
 * Returns a ref to attach to the element that should be considered
 * "inside" and a boolean indicating whether the click-outside backdrop
 * should be rendered.
 *
 * Common pattern in the AP system: click-away backdrop to close menus.
 */

import { useRef, useEffect, useCallback } from 'react'

interface UseClickOutsideOptions {
  /** Called when a click/touch is detected outside the tracked element */
  onOutside: () => void
}

export function useClickOutside({ onOutside }: UseClickOutsideOptions) {
  const ref = useRef<HTMLDivElement>(null)

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside()
      }
    },
    [onOutside],
  )

  useEffect(() => {
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [handlePointerDown])

  return ref
}
