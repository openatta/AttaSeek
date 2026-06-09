/**
 * CronScheduler — In-memory cron job scheduler for the agent session.
 *
 * Manages recurring and one-shot scheduled prompts. Jobs fire when the
 * REPL is idle, pushing system messages into the session's message stream.
 *
 * Jobs are session-only: they die when the session ends. No disk persistence.
 *
 * Mirrors Claude Code's CronCreate/CronDelete/CronList tool pattern.
 */

// ── Types ──

export interface CronJob {
  id: string
  /** 5-field cron expression: minute hour dom month dow */
  cron: string
  /** Prompt to enqueue when the job fires. */
  prompt: string
  /** Whether this is a recurring job (true) or one-shot (false). */
  recurring: boolean
  /** When this job was created (ms timestamp). */
  createdAt: number
  /** When this job last fired (ms timestamp, undefined if never). */
  lastFiredAt?: number
  /** When this job will next fire (ms timestamp). */
  nextFireAt: number
}

// ── Constants ──

const MAX_JOBS = 100
const MIN_INTERVAL_MS = 60_000 // 1 minute minimum

// ── Implementation ──

export class CronScheduler {
  private jobs = new Map<string, CronJob>()
  private timer: ReturnType<typeof setInterval> | null = null
  private onFire: ((job: CronJob) => void) | null = null
  private jitter: () => number

  constructor(jitter?: () => number) {
    // Deterministic jitter for testing, random for production
    this.jitter = jitter || (() => Math.floor(Math.random() * 5000))
  }

  /**
   * Start the scheduler. The `onFire` callback is invoked each time
   * a job fires with the job's prompt.
   */
  start(onFire: (job: CronJob) => void): void {
    this.onFire = onFire
    // Check every 30 seconds for jobs that need to fire
    this.timer = setInterval(() => this.tick(), 30_000)
    this.timer.unref?.() // Don't keep the process alive
  }

  /** Stop the scheduler and clear all jobs. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.jobs.clear()
    this.onFire = null
  }

  /** Schedule a new job. Returns the job ID. */
  create(cron: string, prompt: string, recurring: boolean = true): { id: string; error?: string } {
    if (this.jobs.size >= MAX_JOBS) {
      return { id: '', error: `Max ${MAX_JOBS} jobs reached` }
    }

    const nextFire = this.parseNextFire(cron)
    if (nextFire === null) {
      return { id: '', error: `Invalid cron expression: "${cron}"` }
    }

    const now = Date.now()
    if (nextFire < now + MIN_INTERVAL_MS && nextFire > now) {
      // Too soon — clamp to minimum interval
    }

    const id = `cron_${now}_${Math.random().toString(36).slice(2, 8)}`
    const job: CronJob = {
      id, cron, prompt, recurring,
      createdAt: now,
      nextFireAt: nextFire + this.jitter(),
    }
    this.jobs.set(id, job)
    return { id }
  }

  /** Delete a job by ID. Returns true if the job existed. */
  delete(id: string): boolean {
    return this.jobs.delete(id)
  }

  /** List all active jobs. */
  list(): CronJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => a.nextFireAt - b.nextFireAt)
  }

  /** Get a single job by ID. */
  get(id: string): CronJob | undefined {
    return this.jobs.get(id)
  }

  // ── Internal tick ──

  private tick(): void {
    if (!this.onFire) return
    const now = Date.now()

    for (const [id, job] of this.jobs) {
      if (now >= job.nextFireAt) {
        this.onFire(job)
        job.lastFiredAt = now

        if (job.recurring) {
          // Reschedule
          const nextFire = this.parseNextFire(job.cron)
          if (nextFire !== null) {
            job.nextFireAt = nextFire + this.jitter()
          } else {
            this.jobs.delete(id)
          }
        } else {
          // One-shot — remove after firing
          this.jobs.delete(id)
        }
      }
    }
  }

  // ── Cron parsing (simplified 5-field parser) ──

  private parseNextFire(cron: string): number | null {
    const fields = cron.trim().split(/\s+/)
    if (fields.length !== 5) return null

    const now = new Date()
    const [minute, hour, dom, month, dow] = fields

    // Handle wildcards and simple intervals
    try {
      const target = new Date(now)

      // Set minutes
      if (minute === '*') {
        target.setMinutes(now.getMinutes() + 1)
      } else if (minute.startsWith('*/')) {
        const interval = parseInt(minute.slice(2), 10)
        if (isNaN(interval)) return null
        target.setMinutes(Math.ceil(now.getMinutes() / interval) * interval)
      } else {
        const m = parseInt(minute, 10)
        if (isNaN(m) || m < 0 || m > 59) return null
        target.setMinutes(m)
        if (target <= now) target.setHours(target.getHours() + 1)
      }

      // Set hours
      if (hour === '*') {
        // keep current
      } else if (hour.startsWith('*/')) {
        const interval = parseInt(hour.slice(2), 10)
        if (isNaN(interval)) return null
        target.setHours(Math.ceil(now.getHours() / interval) * interval)
      } else {
        const h = parseInt(hour, 10)
        if (isNaN(h) || h < 0 || h > 23) return null
        target.setHours(h)
        if (target <= now) target.setDate(target.getDate() + 1)
      }

      // Set day of month
      if (dom !== '*' && dom !== '?') {
        const d = parseInt(dom, 10)
        if (isNaN(d) || d < 1 || d > 31) return null
        target.setDate(d)
        if (target <= now) target.setMonth(target.getMonth() + 1)
      }

      // Set month
      if (month !== '*') {
        const m = parseInt(month, 10)
        if (isNaN(m) || m < 1 || m > 12) return null
        target.setMonth(m - 1)
        if (target <= now) target.setFullYear(target.getFullYear() + 1)
      }

      // Day of week (simplified — overrides dom if both set)
      if (dow !== '*' && dow !== '?') {
        // Handle ranges and lists (simplified)
        const targetDow = parseInt(dow.replace(/[^0-9]/g, ''), 10)
        if (!isNaN(targetDow)) {
          const currentDow = target.getDay()
          const daysUntil = (targetDow - currentDow + 7) % 7
          if (daysUntil === 0 && target <= now) {
            target.setDate(target.getDate() + 7)
          } else if (daysUntil > 0) {
            target.setDate(target.getDate() + daysUntil)
          }
        }
      }

      target.setSeconds(0)
      target.setMilliseconds(0)

      if (target.getTime() <= now.getTime()) {
        target.setMinutes(target.getMinutes() + 1)
      }

      return target.getTime()
    } catch {
      return null
    }
  }
}

/** Singleton instance for the current session. */
export const cronScheduler = new CronScheduler()
