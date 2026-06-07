/** TodoWrite tool implementation — structured todo list tracking */

interface TodoItem {
  subject: string
  status: 'pending' | 'in_progress' | 'completed'
  description?: string
}

let currentTodos: TodoItem[] = []

export function cleanupTodoStore(): void { currentTodos = [] }

export const todoWriteImpl = {
  toolId: 'todo_write',
  execute: async (input: Record<string, unknown>) => {
    const todos = input.todos as TodoItem[] | undefined
    if (!Array.isArray(todos)) throw new Error('todos array is required')

    // Merge: update existing items by subject, append new ones
    for (const todo of todos) {
      const existing = currentTodos.findIndex(t => t.subject === todo.subject)
      if (existing >= 0) {
        currentTodos[existing] = { ...currentTodos[existing], ...todo }
      } else {
        currentTodos.push(todo)
      }
    }

    // Remove completed items from the tracked list but note them
    const completed = currentTodos.filter(t => t.status === 'completed')
    const active = currentTodos.filter(t => t.status !== 'completed')
    currentTodos = active

    const lines: string[] = []
    if (active.length > 0) {
      lines.push('## Active Tasks')
      for (const t of active) {
        const icon = t.status === 'in_progress' ? '⏳' : '⬜'
        lines.push(`${icon} ${t.subject}${t.description ? ` — ${t.description}` : ''}`)
      }
    }
    if (completed.length > 0) {
      lines.push('', '## Completed')
      for (const t of completed) {
        lines.push(`✅ ${t.subject}`)
      }
    }
    return lines.join('\n') || '(no tasks)'
  },
}
