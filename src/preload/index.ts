/**
 * Preload — secure IPC bridge between main and renderer.
 *
 * IPC channel naming convention: `feature:action` (e.g., `agent:create-task`).
 * - All channels follow this pattern.
 * - When a channel is superseded, mark the old handler with @deprecated
 *   and keep it for one release cycle before removal.
 * - Never change the request/response shape of an existing channel;
 *   create a new channel instead.
 *
 * Type imports from shared/types/ provide concrete return types instead of `unknown`,
 * enabling type-safe access from the renderer.
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { AgentTask } from '../shared/types/AgentTask'
import type { SessionEvent } from '../shared/types/SessionEvent'
import type { Artifact, ArtifactSummary } from '../shared/types/Artifact'
import type { MemoryEntry } from '../shared/types/Memory'
import type { AuditLog } from '../shared/types/Audit'
import type { PermissionPolicy } from '../shared/types/Permission'
import type { PluginManifest } from '../shared/types/Plugin'
import type { SkillManifest } from '../shared/types/Skill'
import type { ToolManifest } from '../shared/types/Tool'
import type { ModelConfig } from '../shared/types/model'

/** Session shape returned by IPC — kept inline to avoid unnecessary indirection */
interface SessionInfo {
  id: string; title: string; activity: string; createdAt: number; updatedAt: number
}

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
    createTask: (goal: string, sessionId: string, projectId?: string, modelConfigId?: string, modelName?: string): Promise<{ success: boolean; task?: AgentTask; error?: string }> =>
      ipcRenderer.invoke('agent:create-task', { goal, sessionId, projectId, modelConfigId, modelName }),
    cancelTask: (taskId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('agent:cancel-task', { taskId }),
    getTask: (taskId: string): Promise<{ task: AgentTask | null }> =>
      ipcRenderer.invoke('agent:get-task', { taskId }),
    listEvents: (sessionId: string): Promise<{ events: SessionEvent[] }> =>
      ipcRenderer.invoke('agent:list-events', { sessionId }),
    onEvent: (cb: (event: SessionEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: SessionEvent) => cb(data)
      ipcRenderer.on('agent:event', listener)
      return () => ipcRenderer.removeListener('agent:event', listener)
    }
  },

  // Artifact API
  artifact: {
    list: (sessionId: string): Promise<{ artifacts: ArtifactSummary[] }> =>
      ipcRenderer.invoke('artifact:list', { sessionId }),
    get: (artifactId: string): Promise<{ artifact: Artifact | null }> =>
      ipcRenderer.invoke('artifact:get', { artifactId }),
    update: (artifactId: string, patch: Record<string, unknown>): Promise<{ artifact: Artifact | null }> =>
      ipcRenderer.invoke('artifact:update', { artifactId, patch }),
  },

  // Skill API
  skill: {
    list: (): Promise<{ skills: SkillManifest[] }> =>
      ipcRenderer.invoke('skill:list'),
  },

  // Tool API
  tool: {
    list: (): Promise<{ tools: ToolManifest[] }> =>
      ipcRenderer.invoke('tool:list'),
  },

  // Permission API
  permission: {
    respond: (requestId: string, decision: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('permission:respond', { requestId, decision }),
    listPolicies: (): Promise<{ policies: PermissionPolicy[] }> =>
      ipcRenderer.invoke('permission:list-policies'),
    updatePolicy: (id: string, decision: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('permission:update-policy', { id, decision }),
  },

  // Memory API
  memory: {
    list: (filters?: Record<string, unknown>): Promise<{ entries: MemoryEntry[] }> =>
      ipcRenderer.invoke('memory:list', filters || {}),
    store: (entry: Record<string, unknown>): Promise<{ entry: MemoryEntry }> =>
      ipcRenderer.invoke('memory:store', entry),
    delete: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('memory:delete', { id }),
  },

  // Audit API
  audit: {
    list: (filters?: Record<string, unknown>): Promise<{ logs: AuditLog[] }> =>
      ipcRenderer.invoke('audit:list', filters || {}),
  },

  // Model config API
  model: {
    list: (): Promise<{ configs: ModelConfig[] }> =>
      ipcRenderer.invoke('model:list'),
    get: (id: string): Promise<{ config: ModelConfig | null }> =>
      ipcRenderer.invoke('model:get', { id }),
    create: (config: Record<string, unknown>): Promise<{ config: ModelConfig }> =>
      ipcRenderer.invoke('model:create', { config }),
    update: (id: string, patch: Record<string, unknown>): Promise<{ config: ModelConfig | null }> =>
      ipcRenderer.invoke('model:update', { id, patch }),
    delete: (id: string): Promise<{ success: boolean; needNewDefault?: boolean }> =>
      ipcRenderer.invoke('model:delete', { id }),
    setDefault: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('model:set-default', { id }),
    test: (id: string): Promise<{ success: boolean; latencyMs?: number; model?: string; error?: string }> =>
      ipcRenderer.invoke('model:test', { id }),
    usage: (configId?: string, periodDays?: number): Promise<{ stats: Record<string, unknown> }> =>
      ipcRenderer.invoke('model:usage', { configId, periodDays }),
    getKeyInfo: (id: string): Promise<{ info: { exists: boolean; preview: string } | null }> =>
      ipcRenderer.invoke('model:get-key-info', { id }),
    hasConfig: (): Promise<{ configured: boolean }> =>
      ipcRenderer.invoke('model:has-config'),
  },

  // Session API
  session: {
    create: (title?: string, activity?: string, id?: string): Promise<{ session: SessionInfo }> =>
      ipcRenderer.invoke('session:create', { title, activity, id }),
    list: (): Promise<{ sessions: SessionInfo[] }> =>
      ipcRenderer.invoke('session:list'),
    get: (id: string): Promise<{ session: SessionInfo | null }> =>
      ipcRenderer.invoke('session:get', { id }),
    update: (id: string, patch: Record<string, unknown>): Promise<{ session: SessionInfo | null }> =>
      ipcRenderer.invoke('session:update', { id, ...patch }),
    delete: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('session:delete', { id }),
    onUpdate: (cb: (data: { id: string; title: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { id: string; title: string }) => cb(data)
      ipcRenderer.on('session:updated', listener)
      return () => ipcRenderer.removeListener('session:updated', listener)
    },
  },

  // Plugin API
  plugin: {
    list: (): Promise<{ plugins: PluginManifest[] }> =>
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
