/**
 * Preload — secure IPC bridge between main and renderer.
 *
 * IPC channel naming convention: `feature:action` (e.g., `agent:create-task`).
 * - All channels follow this pattern.
 * - When a channel is superseded, mark the old handler with @deprecated
 *   and keep it for one release cycle before removal.
 * - Never change the request/response shape of an existing channel;
 *   create a new channel instead.
 */

import { contextBridge, ipcRenderer } from 'electron'

const api = {
  platform: process.platform,
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',

  theme: {
    get: (): Promise<{ theme: string }> => ipcRenderer.invoke('theme:get'),
    set: (theme: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('theme:set', { theme }),
    onSystemChange: (cb: (theme: 'dark' | 'light') => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { theme: string }) =>
        cb(data.theme as 'dark' | 'light')
      ipcRenderer.on('theme:system-changed', listener)
      return () => ipcRenderer.removeListener('theme:system-changed', listener)
    }
  },

  // Agent API
  agent: {
    createTask: (goal: string, sessionId: string, projectId?: string, modelConfigId?: string, modelName?: string): Promise<{ success: boolean; task?: unknown; error?: string }> =>
      ipcRenderer.invoke('agent:create-task', { goal, sessionId, projectId, modelConfigId, modelName }),
    cancelTask: (taskId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('agent:cancel-task', { taskId }),
    getTask: (taskId: string): Promise<{ task: unknown | null }> =>
      ipcRenderer.invoke('agent:get-task', { taskId }),
    listEvents: (sessionId: string): Promise<{ events: unknown[] }> =>
      ipcRenderer.invoke('agent:list-events', { sessionId }),
    onEvent: (cb: (event: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: unknown) => cb(data)
      ipcRenderer.on('agent:event', listener)
      return () => ipcRenderer.removeListener('agent:event', listener)
    }
  },

  // Artifact API
  artifact: {
    list: (sessionId: string): Promise<{ artifacts: unknown[] }> =>
      ipcRenderer.invoke('artifact:list', { sessionId }),
    get: (artifactId: string): Promise<{ artifact: unknown | null }> =>
      ipcRenderer.invoke('artifact:get', { artifactId }),
    update: (artifactId: string, patch: Record<string, unknown>): Promise<{ artifact: unknown | null }> =>
      ipcRenderer.invoke('artifact:update', { artifactId, patch }),
  },

  // Skill API
  skill: {
    list: (): Promise<{ skills: unknown[] }> =>
      ipcRenderer.invoke('skill:list'),
  },

  // Tool API
  tool: {
    list: (): Promise<{ tools: unknown[] }> =>
      ipcRenderer.invoke('tool:list'),
  },

  // Permission API
  permission: {
    respond: (requestId: string, decision: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('permission:respond', { requestId, decision }),
    listPolicies: (): Promise<{ policies: unknown[] }> =>
      ipcRenderer.invoke('permission:list-policies'),
    updatePolicy: (id: string, decision: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('permission:update-policy', { id, decision }),
  },

  // Memory API
  memory: {
    list: (filters?: Record<string, unknown>): Promise<{ entries: unknown[] }> =>
      ipcRenderer.invoke('memory:list', filters || {}),
    store: (entry: Record<string, unknown>): Promise<{ entry: unknown }> =>
      ipcRenderer.invoke('memory:store', entry),
    delete: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('memory:delete', { id }),
  },

  // Audit API
  audit: {
    list: (filters?: Record<string, unknown>): Promise<{ logs: unknown[] }> =>
      ipcRenderer.invoke('audit:list', filters || {}),
  },

  // Model config API
  model: {
    list: (): Promise<{ configs: unknown[] }> =>
      ipcRenderer.invoke('model:list'),
    get: (id: string): Promise<{ config: unknown | null }> =>
      ipcRenderer.invoke('model:get', { id }),
    create: (config: Record<string, unknown>): Promise<{ config: unknown }> =>
      ipcRenderer.invoke('model:create', { config }),
    update: (id: string, patch: Record<string, unknown>): Promise<{ config: unknown | null }> =>
      ipcRenderer.invoke('model:update', { id, patch }),
    delete: (id: string): Promise<{ success: boolean; needNewDefault?: boolean }> =>
      ipcRenderer.invoke('model:delete', { id }),
    setDefault: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('model:set-default', { id }),
    test: (id: string): Promise<{ success: boolean; latencyMs?: number; model?: string; error?: string }> =>
      ipcRenderer.invoke('model:test', { id }),
    usage: (configId?: string, periodDays?: number): Promise<{ stats: unknown }> =>
      ipcRenderer.invoke('model:usage', { configId, periodDays }),
    hasConfig: (): Promise<{ configured: boolean }> =>
      ipcRenderer.invoke('model:has-config'),
  },

  // Session API
  session: {
    create: (title?: string, activity?: string, id?: string): Promise<{ session: unknown }> =>
      ipcRenderer.invoke('session:create', { title, activity, id }),
    list: (): Promise<{ sessions: unknown[] }> =>
      ipcRenderer.invoke('session:list'),
    get: (id: string): Promise<{ session: unknown | null }> =>
      ipcRenderer.invoke('session:get', { id }),
    update: (id: string, patch: Record<string, unknown>): Promise<{ session: unknown | null }> =>
      ipcRenderer.invoke('session:update', { id, ...patch }),
    delete: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('session:delete', { id }),
  },

  // Plugin API
  plugin: {
    list: (): Promise<{ plugins: unknown[] }> =>
      ipcRenderer.invoke('plugin:list'),
  },

  // App state persistence
  app: {
    getState: (key: string): Promise<{ success: boolean; value: string | null }> =>
      ipcRenderer.invoke('app:get-state', key),
    setState: (key: string, value: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('app:set-state', { key, value }),
  },

}

contextBridge.exposeInMainWorld('api', api)

export type AttaSeekAPI = typeof api
