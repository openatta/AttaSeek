/**
 * Shared utilities for IPC handlers and SQLite services.
 */

/** Validate that a field on an object is a string (if present) */
export function validateStringField(obj: Record<string, unknown>, field: string, label: string): void {
  if (obj[field] !== undefined && typeof obj[field] !== 'string') {
    throw new Error(`${label} must be a string`)
  }
}

/** Validate that a field on an object is a required string */
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

/** Convert snake_case SQL row keys to camelCase. Optional JSON fields are deserialized. */
export function fromRow<T>(row: Record<string, unknown> | undefined, jsonFields?: string[]): T | undefined {
  if (!row) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => (c as string).toUpperCase())
    if (jsonFields?.includes(camel) && typeof value === 'string') {
      try { out[camel] = JSON.parse(value) } catch { out[camel] = value }
    } else {
      out[camel] = value
    }
  }
  return out as T
}
