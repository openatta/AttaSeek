/**
 * QueryProfiler — performance measurement for the agent query pipeline.
 *
 * Activation (checked once per query, at query_loop_entry):
 *   1. ATTA_PROFILE_QUERY=1 — force-enable for all queries (debug mode)
 *   2. ATTA_PROFILE_SAMPLE_RATE=0.05 — sample 5% of queries (default: 0.01 = 1%)
 *   3. Otherwise — disabled (zero overhead)
 *
 * When activated for a query, records timing checkpoints through the query
 * loop to identify bottlenecks. Disabled queries have zero overhead (all
 * checkpoint calls are no-ops).
 *
 * Checkpoints tracked:
 *   - query_setup_end: End of context assembly & prompt rendering
 *   - query_loop_entry: Entry to queryLoop()
 *   - compaction_start / compaction_end: Compaction pipeline duration
 *   - api_streaming_start: Start of LLM streaming call
 *   - first_chunk_received: First streaming chunk (TTFT)
 *   - api_streaming_end: End of LLM streaming
 *   - tool_execution_start / tool_execution_end: Tool batch duration
 *   - tool_summary_generated: Tool summary generation complete
 *   - query_loop_exit: Loop termination
 */

// ── Module state ──

const DEFAULT_SAMPLE_RATE = 0.01 // 1% of queries

let ENABLED = false
let checkpoints: Array<{ name: string; time: number }> = []
let queryCount = 0
let profiledQueryCount = 0
let firstTokenTime: number | null = null

function isTruthy(val: string | undefined): boolean {
  return val !== undefined && val !== '0' && val !== 'false' && val !== ''
}

function getSampleRate(): number {
  const envVal = process.env['ATTA_PROFILE_SAMPLE_RATE']
  if (envVal !== undefined) {
    const parsed = parseFloat(envVal)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed
  }
  return DEFAULT_SAMPLE_RATE
}

function init(): void {
  // Force-enable takes priority (debug mode)
  if (isTruthy(process.env['ATTA_PROFILE_QUERY'])) {
    ENABLED = true
    return
  }
  // Sample-based activation: roll the dice once per query
  const rate = getSampleRate()
  ENABLED = rate > 0 && Math.random() < rate
}

// Lazy init on first use; re-rolled per query for sampling
let _initialized = false

export function queryCheckpoint(name: string): void {
  if (!_initialized) {
    init()
    _initialized = true
  }

  // Re-roll sampling decision at the start of each query (unless force-enabled)
  if (name === 'query_loop_entry') {
    if (!isTruthy(process.env['ATTA_PROFILE_QUERY'])) {
      // Sample-based: fresh roll per query
      const rate = getSampleRate()
      ENABLED = rate > 0 && Math.random() < rate
    }
  }

  if (!ENABLED) return

  if (name === 'query_loop_entry') {
    checkpoints = []
    queryCount++
    profiledQueryCount++
    firstTokenTime = null
  }

  checkpoints.push({ name, time: performance.now() })

  if (name === 'first_chunk_received' && firstTokenTime === null) {
    firstTokenTime = performance.now()
  }
}

/**
 * Log a formatted profiling report to stdout.
 * Call once at query loop exit.
 */
export function logQueryProfileReport(): void {
  if (!ENABLED || checkpoints.length === 0) return

  const baseline = checkpoints[0].time
  const lines: string[] = []
  lines.push(`\n[QueryProfiler] Query #${queryCount} — ${checkpoints.length} checkpoints`)
  lines.push('-'.repeat(60))

  let prevTime = baseline
  for (const cp of checkpoints) {
    const relative = (cp.time - baseline).toFixed(1)
    const delta = (cp.time - prevTime).toFixed(1)
    const flag = delta > '100' ? ' ⚠️ SLOW' : ''
    lines.push(`  ${relative.padStart(8)}ms  +${delta.padStart(8)}ms  ${cp.name}${flag}`)
    prevTime = cp.time
  }

  // Phase breakdown
  lines.push('')
  lines.push('Phase summary:')
  const phases = [
    ['compaction', 'compaction_start', 'compaction_end'],
    ['API streaming', 'api_streaming_start', 'api_streaming_end'],
    ['tool execution', 'tool_execution_start', 'tool_execution_end'],
  ]
  const map = new Map(checkpoints.map(c => [c.name, c.time]))
  for (const [label, start, end] of phases) {
    const s = map.get(start)
    const e = map.get(end)
    if (s !== undefined && e !== undefined) {
      const dur = (e - s).toFixed(1)
      lines.push(`  ${label.padEnd(20)} ${dur.padStart(8)}ms`)
    }
  }

  // TTFT
  if (firstTokenTime !== null) {
    const ttft = (firstTokenTime - baseline).toFixed(1)
    lines.push(`  ${'TTFT'.padEnd(20)} ${ttft.padStart(8)}ms`)
  }

  const total = (checkpoints[checkpoints.length - 1].time - baseline).toFixed(1)
  lines.push(`  ${'TOTAL'.padEnd(20)} ${total.padStart(8)}ms`)
  lines.push('-'.repeat(60))

  console.log(lines.join('\n'))
}
