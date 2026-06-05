/**
 * Performance measurement — lightweight timers and counters for benchmarking.
 *
 * Usage:
 *   const stop = startTimer('label')     // high-res timer, logs on stop()
 *   perf.mark('ipc', 'agent:create-task', 42)  // record a metric
 *   perf.getStats()                      // dump all collected metrics
 */

// ── High-res timer ──

export function startTimer(label: string): () => void {
  const t0 = performance.now()
  return () => console.log(`[perf] ${label}: ${Math.round(performance.now() - t0)}ms`)
}

// ── Metrics collector ──

interface MetricPoint {
  value: number
  timestamp: number
}

interface MetricSeries {
  category: string
  name: string
  points: MetricPoint[]
  lastValue: number
  sum: number
  count: number
  min: number
  max: number
}

class PerfCollector {
  private metrics = new Map<string, MetricSeries>()
  private maxPoints = 100 // keep last N points per series

  /** Record a timing value (ms) */
  mark(category: string, name: string, valueMs: number): void {
    const key = `${category}:${name}`
    let series = this.metrics.get(key)
    if (!series) {
      series = { category, name, points: [], lastValue: 0, sum: 0, count: 0, min: Infinity, max: -Infinity }
      this.metrics.set(key, series)
    }
    const point: MetricPoint = { value: valueMs, timestamp: Date.now() }
    series.points.push(point)
    if (series.points.length > this.maxPoints) series.points.shift()
    series.lastValue = valueMs
    series.sum += valueMs
    series.count++
    series.min = Math.min(series.min, valueMs)
    series.max = Math.max(series.max, valueMs)
  }

  /** Get P95 of recent points for a metric */
  p95(category: string, name: string): number | null {
    const series = this.metrics.get(`${category}:${name}`)
    if (!series || series.points.length < 20) return null
    const sorted = [...series.points].map((p) => p.value).sort((a, b) => a - b)
    const idx = Math.ceil(sorted.length * 0.95) - 1
    return sorted[idx]
  }

  /** Get summary stats for a metric */
  stats(category: string, name: string) {
    const series = this.metrics.get(`${category}:${name}`)
    if (!series) return null
    return {
      last: series.lastValue,
      avg: series.count > 0 ? Math.round(series.sum / series.count) : 0,
      min: series.min === Infinity ? 0 : series.min,
      max: series.max === -Infinity ? 0 : series.max,
      p95: this.p95(category, name),
      count: series.count,
    }
  }

  /** Dump all collected stats */
  getAllStats(): Record<string, ReturnType<typeof this.stats>> {
    const result: Record<string, any> = {}
    for (const [key] of this.metrics) {
      const [cat, name] = key.split(':')
      result[key] = this.stats(cat, name)
    }
    return result
  }

  /** Reset all metrics */
  reset(): void {
    this.metrics.clear()
  }
}

export const perf = new PerfCollector()

// ── IPC timing wrapper ──

/** Wrap an IPC handler to measure and log invocation latency */
export function withIpcTiming<T>(
  channel: string,
  handler: (...args: any[]) => Promise<T>,
): (...args: any[]) => Promise<T> {
  return async (...args: any[]) => {
    const start = performance.now()
    try {
      return await handler(...args)
    } finally {
      const elapsed = performance.now() - start
      perf.mark('ipc', channel, elapsed)
      if (elapsed > 50) {
        console.warn(`[perf] slow IPC: ${channel} took ${Math.round(elapsed)}ms`)
      }
    }
  }
}

// ── Performance targets (from G8) ──

export const PERF_TARGETS = {
  coldStart: 3000,        // app.on('ready') → ready-to-show (ms)
  activitySwitch: 100,    // React Profiler (ms)
  ipcInvokeP95: 50,       // IPC invoke latency P95 (ms)
  eventPushLatency: 200,  // emit → renderer render (ms)
  artifactRender: 500,    // ≤100KB artifact render (ms)
  scrollFrame: 16,        // Conversation <500 msgs scroll frame (ms)
  sqliteWriteP95: 10,     // better-sqlite3 sync write (ms)
} as const

/** Check if a value exceeds its target */
export function checkTarget(metric: keyof typeof PERF_TARGETS, value: number): boolean {
  const target = PERF_TARGETS[metric]
  if (value > target) {
    console.warn(`[perf] target exceeded: ${metric} = ${Math.round(value)}ms (target: ${target}ms)`)
    return false
  }
  return true
}
