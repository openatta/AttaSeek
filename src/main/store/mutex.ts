/**
 * Lightweight promise-chain mutex for serialising async read-modify-write operations.
 * No external dependencies — testable in isolation.
 */

let _lock: Promise<void> = Promise.resolve()

/** Serialise async operations through a promise-chain. Exported for testing. */
export function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const prev = _lock
  let release!: () => void
  _lock = new Promise<void>(resolve => { release = resolve })
  return prev.then(() => fn().finally(release))
}

/** Reset the internal lock (for tests only). */
export function _resetMutex(): void {
  _lock = Promise.resolve()
}
