/**
 * Generic Registry<T> — typed Map wrapper with plugin lifecycle support.
 *
 * All four registries (activity, artifactRenderer, sidebar, inlineRenderer)
 * share the same register/get/list/unregisterByPlugin pattern. This base class
 * eliminates the boilerplate duplication.
 */

export class Registry<T extends { pluginId?: string }> {
  private map = new Map<string, T>()

  register(key: string, value: T): void {
    if (this.map.has(key)) {
      console.warn(`[Registry] overwriting key: ${key}`)
    }
    this.map.set(key, value)
  }

  get(key: string): T | undefined {
    return this.map.get(key)
  }

  has(key: string): boolean {
    return this.map.has(key)
  }

  list(predicate?: (value: T) => boolean): T[] {
    const all = Array.from(this.map.values())
    return predicate ? all.filter(predicate) : all
  }

  unregisterByPlugin(pluginId: string): void {
    for (const [key, value] of this.map) {
      if (value.pluginId === pluginId) {
        this.map.delete(key)
      }
    }
  }

  entries(): IterableIterator<[string, T]> {
    return this.map.entries()
  }

  values(): IterableIterator<T> {
    return this.map.values()
  }
}
