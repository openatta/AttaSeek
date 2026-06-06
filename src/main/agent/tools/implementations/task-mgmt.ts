/** Task management tools — task_create, task_update, task_list, task_output */
let taskStore: { id: string; title: string; status: string; sessionId: string; goal: string; output?: string }[] = []

export function cleanupTaskStore(): void { taskStore = [] }

export const taskCreateImpl = {
  toolId: 'task_create',
  execute: async (input: Record<string, unknown>) => {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
    const entry = { id, title: String(input.subject || input.title || ''), status: 'pending', sessionId: String(input.sessionId || ''), goal: String(input.description || input.goal || '') }
    taskStore.push(entry); return `Created task ${id}: ${entry.title}`
  },
}

export const taskUpdateImpl = {
  toolId: 'task_update',
  execute: async (input: Record<string, unknown>) => {
    const t = taskStore.find(t => t.id === String(input.taskId || ''))
    if (!t) throw new Error(`Task ${input.taskId} not found`)
    if (input.status) t.status = String(input.status); if (input.title) t.title = String(input.title)
    return `Updated task ${t.id}: status=${t.status}`
  },
}

export const taskListImpl = {
  toolId: 'task_list',
  execute: async () => taskStore.map(t => `[${t.status}] ${t.id}: ${t.title}`).join('\n') || '(no tasks)',
}

export const taskOutputImpl = {
  toolId: 'task_output',
  execute: async (input: Record<string, unknown>) => {
    const t = taskStore.find(t => t.id === String(input.taskId || ''))
    return t?.output || t ? `Task ${t.id}: status=${t.status}, no output yet` : `Task ${input.taskId} not found`
  },
}
