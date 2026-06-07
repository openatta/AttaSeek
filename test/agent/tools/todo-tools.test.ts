/**
 * TodoWrite tool — unit tests for structured todo list tracking.
 */

import { describe, it, expect } from 'vitest'
import { todoWriteImpl, cleanupTodoStore } from '../../../src/main/agent/tools/implementations/todo-impl'

describe('TodoWrite tool', () => {
  it('should create new todos', async () => {
    cleanupTodoStore()
    const result = await todoWriteImpl.execute({
      todos: [
        { subject: 'Task A', status: 'pending' },
        { subject: 'Task B', status: 'in_progress' },
      ],
    })
    expect(result as string).toContain('Task A')
    expect(result as string).toContain('Task B')
  })

  it('should update existing todos by subject', async () => {
    cleanupTodoStore()
    await todoWriteImpl.execute({ todos: [{ subject: 'Task X', status: 'pending' }] })
    const result = await todoWriteImpl.execute({ todos: [{ subject: 'Task X', status: 'completed' }] })
    expect(result as string).toContain('Completed')
  })

  it('should require todos array', async () => {
    cleanupTodoStore()
    await expect(todoWriteImpl.execute({})).rejects.toThrow('todos array is required')
  })

  it('should format active and completed sections', async () => {
    cleanupTodoStore()
    const result = await todoWriteImpl.execute({
      todos: [
        { subject: 'Active 1', status: 'in_progress' },
        { subject: 'Done 1', status: 'completed' },
      ],
    })
    expect(result as string).toContain('Active 1')
    expect(result as string).toContain('Done 1')
  })
})
