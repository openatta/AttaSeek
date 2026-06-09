/**
 * Shared utilities for IPC handlers and storage services.
 */

/** Validate that a field on an object is a required non-empty string */
export function validateRequiredString(obj: Record<string, unknown>, field: string, label: string): void {
  if (typeof obj[field] !== 'string' || !obj[field]) {
    throw new Error(`${label} is required and must be a non-empty string`)
  }
}

/** Wrap a sync IPC handler function with try/catch → { success, ...fn() | error } */
export function ipcWrap<T extends Record<string, unknown>>(fn: () => T) {
  try { return { success: true as const, ...fn() } }
  catch (err) { return { success: false as const, error: err instanceof Error ? err.message : 'Internal error' } }
}

/** Wrap an async IPC handler function with try/catch → { success, ...await fn() | error } */
export async function ipcWrapAsync<T extends Record<string, unknown>>(fn: () => Promise<T>) {
  try { return { success: true as const, ...await fn() } }
  catch (err) { return { success: false as const, error: err instanceof Error ? err.message : 'Internal error' } }
}
