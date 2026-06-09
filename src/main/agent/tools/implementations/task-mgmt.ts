/** Task management tools — task_create, task_update, task_list, task_output, task_stop */
import { TaskStore } from '../../../store/TaskStore'
import { taskNotificationQueue } from '../../TaskNotificationQueue'

export function cleanupTaskStore(): void { TaskStore.clear() }

export const taskCreateImpl = {
  toolId: 'task_create',
  execute: async (input: Record<string, unknown>) => {
    const t = TaskStore.create({
      subject: String(input.subject || ''),
      title: String(input.title || ''),
      description: String(input.description || ''),
      goal: String(input.goal || ''),
      sessionId: String(input.sessionId || ''),
    })
    return `Created task ${t.id}: ${t.title}`
  },
}

export const taskUpdateImpl = {
  toolId: 'task_update',
  execute: async (input: Record<string, unknown>) => {
    const taskId = String(input.taskId || '')
    const t = TaskStore.get(taskId)
    if (!t) throw new Error(`Task ${taskId} not found`)
    const patch: { status?: string; title?: string } = {}
    if (input.status) patch.status = String(input.status)
    if (input.title) patch.title = String(input.title)
    const updated = TaskStore.update(taskId, patch)
    return `Updated task ${updated!.id}: status=${updated!.status}`
  },
}

export const taskListImpl = {
  toolId: 'task_list',
  execute: async (input: Record<string, unknown>) => {
    const sessionId = input.sessionId ? String(input.sessionId) : undefined
    const tasks = TaskStore.list(sessionId)
    return tasks.map(t => `[${t.status}] ${t.id}: ${t.title}`).join('\n') || '(no tasks)'
  },
}

export const taskOutputImpl = {
  toolId: 'task_output',
  execute: async (input: Record<string, unknown>) => {
    const taskId = String(input.taskId || '')
    const t = TaskStore.get(taskId)
    return t?.output || t ? `Task ${t.id}: status=${t.status}, no output yet` : `Task ${taskId} not found`
  },
}

export const taskStopImpl = {
  toolId: 'task_stop',
  execute: async (input: Record<string, unknown>) => {
    const taskId = String(input.task_id || '').trim()
    if (!taskId) throw new Error('task_id is required')

    // Try stopping a TaskStore task first
    const storedTask = TaskStore.get(taskId)
    if (storedTask) {
      if (storedTask.status === 'completed' || storedTask.status === 'failed') {
        return `Task ${taskId} is already ${storedTask.status} — nothing to stop`
      }
      TaskStore.update(taskId, { status: 'cancelled' })
      // Cancel any pending notification for this worker
      taskNotificationQueue.cancel(taskId)
      return `Stopped task ${taskId}. It can be continued with send_message.`
    }

    // Try stopping a SubAgentManager sub-agent
    try {
      const { subAgentManager } = await import('../../subagent/SubAgentManager')
      const agentInfo = subAgentManager.get(taskId)
      if (agentInfo && agentInfo.status === 'running') {
        subAgentManager.cancel(taskId)
        taskNotificationQueue.cancel(taskId)
        return `Stopped worker agent "${taskId}" (${agentInfo.agentType}). It can be continued with send_message.`
      }
    } catch { /* SubAgentManager not available in this context */ }

    throw new Error(`Task or worker "${taskId}" not found. Check the ID and try again.`)
  },
}
