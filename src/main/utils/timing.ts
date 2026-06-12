/**
 * Shared timing utilities — debounce, throttle, delay helpers.
 *
 * Single source of truth for debounce logic, replacing ad-hoc
 * implementations in WindowState, TrayManager, and AgentEventBus.
 */

/** Standard trailing-edge debounce. Returns a function that delays `fn`
 *  until `ms` milliseconds have elapsed since the last invocation. */
export function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
}
