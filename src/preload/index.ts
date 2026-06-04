import { contextBridge, ipcRenderer } from 'electron'

// Minimal secure API surface exposed to the renderer process.
// All system capabilities go through here — the renderer never
// accesses Node.js or Electron APIs directly.

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
    createTask: (goal: string, sessionId: string, projectId?: string): Promise<{ success: boolean; task?: unknown; error?: string }> =>
      ipcRenderer.invoke('agent:create-task', { goal, sessionId, projectId }),
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

  // Plugin API
  plugin: {
    list: (): Promise<{ plugins: unknown[] }> =>
      ipcRenderer.invoke('plugin:list'),
  },

  // Generic IPC stub — expand as features are built
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type AttaSeekAPI = typeof api
