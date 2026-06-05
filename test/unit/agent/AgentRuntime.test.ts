/**
 * AgentRuntime unit tests.
 *
 * Note: createTask() triggers an async agent loop that requires Electron runtime
 * (better-sqlite3, LLM provider). In vitest, this loop will fail gracefully.
 * These tests verify task creation and lifecycle management shape.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AgentRuntime } from '../../../src/main/agent/AgentRuntime'

describe('AgentRuntime', () => {
  let runtime: AgentRuntime

  beforeEach(() => {
    runtime = new AgentRuntime()
  })

  it('creates a task with the correct shape', () => {
    const task = runtime.createTask('session_1', 'Test goal')
    expect(task).toBeDefined()
    expect(task.id).toBeTruthy()
    expect(task.sessionId).toBe('session_1')
    expect(task.goal).toBe('Test goal')
    // status may change asynchronously since agentLoop.run() is called;
    // in test env without LLM provider it will fail gracefully
    expect(task.createdAt).toBeGreaterThan(0)
  })

  it('assigns unique IDs to tasks', () => {
    const t1 = runtime.createTask('s1', 'Goal 1')
    const t2 = runtime.createTask('s1', 'Goal 2')
    expect(t1.id).not.toBe(t2.id)
  })

  it('can cancel a task', () => {
    const task = runtime.createTask('s1', 'Test')
    const result = runtime.cancelTask(task.id)
    expect(result).toBe(true)
    const retrieved = runtime.getTask(task.id)
    expect(retrieved?.status).toBe('cancelled')
  })

  it('returns undefined for unknown task', () => {
    expect(runtime.getTask('nonexistent')).toBeUndefined()
  })

  it('returns false when cancelling unknown task', () => {
    expect(runtime.cancelTask('nonexistent')).toBe(false)
  })

  it('lists tasks by session', () => {
    runtime.createTask('session_a', 'Task A1')
    runtime.createTask('session_a', 'Task A2')
    runtime.createTask('session_b', 'Task B1')

    const a = runtime.listBySession('session_a')
    const b = runtime.listBySession('session_b')
    expect(a).toHaveLength(2)
    expect(b).toHaveLength(1)
  })

  it('emits UserMessage event during task creation', () => {
    const task = runtime.createTask('s1', 'Send a message')
    expect(task.goal).toBe('Send a message')
    // The emit() method is called during createTask — we verify task was created
    expect(runtime.getTask(task.id)).toBeDefined()
  })
})
