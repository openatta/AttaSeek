import { useCallback, useRef } from 'react'

/**
 * useDragResize — generic drag-to-resize hook.
 *
 * Attaches mousemove/mouseup/pointercancel/pointerleave listeners to document
 * during a drag gesture, calling the setter with delta adjustments.
 * Cleans up listeners on gesture end. No cleanup on unmount needed since
 * listeners are removed synchronously on each gesture completion.
 *
 * @param setter  Receives a delta function: (prev) => clamped(prev + delta)
 * @param clamp   Optional min/max bounds. Defaults to no clamping.
 */
export function useDragResize(
  setter: (fn: (prev: number) => number) => void,
  clamp?: { min: number; max: number },
) {
  const draggingRef = useRef(false)

  const onMouseDown = useCallback(() => {
    draggingRef.current = true
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      setter((w) => {
        const next = w + e.movementX
        if (clamp) return Math.min(clamp.max, Math.max(clamp.min, next))
        return next
      })
    }
    const cleanup = () => {
      draggingRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', cleanup)
      document.removeEventListener('pointercancel', cleanup)
      document.removeEventListener('pointerleave', cleanup)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', cleanup)
    document.addEventListener('pointercancel', cleanup)
    document.addEventListener('pointerleave', cleanup)
  }, [setter, clamp])

  return onMouseDown
}
