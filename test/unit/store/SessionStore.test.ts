/**
 * SessionStore index mutex tests.
 *
 * Verifies that the promise-chain mutex (withMutex) serialises concurrent
 * async read-modify-write operations, preventing lost updates from
 * overlapping index writes.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { withMutex, _resetMutex } from '../../../src/main/store/mutex'

describe('SessionStore index mutex', () => {
  beforeEach(() => {
    _resetMutex()
  })

  it('serialises concurrent async operations', async () => {
    const order: number[] = []

    const ops = [
      withMutex(async () => {
        order.push(1)
        await new Promise(r => setTimeout(r, 10))
        return 1
      }),
      withMutex(async () => {
        order.push(2)
        await new Promise(r => setTimeout(r, 5))
        return 2
      }),
      withMutex(async () => {
        order.push(3)
        return 3
      }),
    ]

    const results = await Promise.all(ops)
    expect(results).toEqual([1, 2, 3])
    // Operations ran in FIFO serial order, not interleaved
    expect(order).toEqual([1, 2, 3])
  })

  it('releases the lock even when an operation throws', async () => {
    const order: number[] = []

    const ops = [
      withMutex(async () => { order.push(1); return 1 }),
      withMutex(async () => { order.push(2); throw new Error('op 2 failed') }),
      withMutex(async () => { order.push(3); return 3 }),
    ]

    const results = await Promise.allSettled(ops)
    const values = results.map(r =>
      r.status === 'fulfilled' ? (r as PromiseFulfilledResult<number>).value : null,
    )

    // Op 3 still ran after op 2 failed — lock released via .finally()
    expect(order).toEqual([1, 2, 3])
    expect(values).toEqual([1, null, 3])
  })

  it('handles rapid concurrent access without deadlock', async () => {
    const N = 50
    const completed: number[] = []

    const ops = Array.from({ length: N }, (_, i) =>
      withMutex(async () => {
        completed.push(i)
        return i
      }),
    )

    const results = await Promise.all(ops)
    expect(results).toHaveLength(N)
    expect(completed).toEqual(Array.from({ length: N }, (_, i) => i))
  })

  it('simulates index read-modify-write that would lose updates without mutex', async () => {
    // Simulate an index array that gets read, modified, and written back.
    // Without serialisation, concurrent operations would race on the shared state.
    let index: number[] = []

    const addToIndex = (value: number) =>
      withMutex(async () => {
        // Read current state
        const current = [...index]
        // Simulate I/O delay (like fs.readFile)
        await new Promise(r => setTimeout(r, 2))
        // Modify
        current.push(value)
        // Write back (like fs.writeFile)
        index = current
        return value
      })

    // Launch 20 concurrent "add to index" operations
    const ops = Array.from({ length: 20 }, (_, i) => addToIndex(i))
    await Promise.all(ops)

    // All 20 values made it — no lost updates
    expect(index).toHaveLength(20)
    expect(index).toEqual(Array.from({ length: 20 }, (_, i) => i))
  })
})
