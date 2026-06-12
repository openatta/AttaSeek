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
import type { AgentTask, SessionInfo } from '../shared/types/AgentTask'
import type { SessionEvent } from '../shared/types/SessionEvent'
import type { Artifact, ArtifactSummary } from '../shared/types/Artifact'
import type { DirEntry, GitFileStatus, GitDiffFile, GitCommit, ProjectInfo } from '../shared/types/ipc'
import type { MemoryEntry, MemoryQuery } from '../shared/types/Memory'
import type { AuditLog, AuditFilters } from '../shared/types/Audit'
import type { PermissionPolicy } from '../shared/types/Permission'
import type { PluginManifest } from '../shared/types/Plugin'
import type { SkillManifest } from '../shared/types/Skill'
import type { ToolManifest } from '../shared/types/Tool'
import type { ModelConfig, CreateModelConfig, ModelConfigPatch, ModelTestResult, UsageStats } from '../shared/types/model'
import type { UpdateStatus, UpdateManifest, UpdateProgress, UpdateEvent, UpdateSettings } from '../shared/types/update'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json') as { version: string }

const api = {
  platform: process.platform,
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',
  version: pkg.version,

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
    createTask: (goal: string, sessionId: string, projectId?: string, modelConfigId?: string, modelName?: string, language?: string): Promise<{ success: boolean; task?: AgentTask; error?: string }> =>
      ipcRenderer.invoke('agent:create-task', { goal, sessionId, projectId, modelConfigId, modelName, language }),
    cancelTask: (taskId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('agent:cancel-task', { taskId }),
    getTask: (taskId: string): Promise<{ success: boolean; task: AgentTask | null }> =>
      ipcRenderer.invoke('agent:get-task', { taskId }),
    listEvents: (sessionId: string): Promise<{ success: boolean; events: SessionEvent[] }> =>
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
    update: (artifactId: string, patch: { content?: string; title?: string }): Promise<{ artifact: Artifact | null }> =>
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
    list: (filters?: MemoryQuery): Promise<{ entries: MemoryEntry[] }> =>
      ipcRenderer.invoke('memory:list', filters || {}),
    store: (entry: Omit<MemoryEntry, 'id' | 'layer' | 'createdAt' | 'updatedAt'>): Promise<{ entry: MemoryEntry }> =>
      ipcRenderer.invoke('memory:store', entry),
    delete: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('memory:delete', { id }),
  },

  // Audit API
  audit: {
    list: (filters?: AuditFilters): Promise<{ logs: AuditLog[] }> =>
      ipcRenderer.invoke('audit:list', filters || {}),
  },

  // Model config API
  model: {
    list: (): Promise<{ configs: ModelConfig[] }> =>
      ipcRenderer.invoke('model:list'),
    get: (id: string): Promise<{ config: ModelConfig | null }> =>
      ipcRenderer.invoke('model:get', { id }),
    create: (config: CreateModelConfig): Promise<{ config: ModelConfig }> =>
      ipcRenderer.invoke('model:create', { config }),
    update: (id: string, patch: ModelConfigPatch): Promise<{ config: ModelConfig | null }> =>
      ipcRenderer.invoke('model:update', { id, patch }),
    delete: (id: string): Promise<{ success: boolean; needNewDefault?: boolean }> =>
      ipcRenderer.invoke('model:delete', { id }),
    setDefault: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('model:set-default', { id }),
    test: (id: string): Promise<ModelTestResult> =>
      ipcRenderer.invoke('model:test', { id }),
    usage: (configId?: string, periodDays?: number): Promise<{ stats: UsageStats }> =>
      ipcRenderer.invoke('model:usage', { configId, periodDays }),
    hasConfig: (): Promise<{ configured: boolean }> =>
      ipcRenderer.invoke('model:has-config'),
  },

  // Session API
  session: {
    create: (title?: string, activity?: string, id?: string, projectId?: string | null): Promise<{ session: SessionInfo }> =>
      ipcRenderer.invoke('session:create', { title, activity, id, projectId }),
    list: (activity?: string, projectId?: string | null): Promise<{ sessions: SessionInfo[] }> =>
      ipcRenderer.invoke('session:list', { activity, projectId }),
    get: (id: string): Promise<{ session: SessionInfo | null }> =>
      ipcRenderer.invoke('session:get', { id }),
    update: (id: string, patch: { title?: string }): Promise<{ session: SessionInfo | null }> =>
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

  // User question API
  question: {
    respond: (questionId: string, answer: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('question:respond', { questionId, answer }),
  },

  // App state persistence + native dialogs
  app: {
    getState: (key: string): Promise<{ success: boolean; value: string | null }> =>
      ipcRenderer.invoke('app:get-state', key),
    setState: (key: string, value: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('app:set-state', { key, value }),
    selectDir: (): Promise<{ success: boolean; canceled?: boolean; path?: string | null; error?: string }> =>
      ipcRenderer.invoke('dialog:select-dir'),
  },

  // Filesystem API
  fs: {
    readDir: (dirPath: string): Promise<{ success: boolean; entries?: DirEntry[]; error?: string }> =>
      ipcRenderer.invoke('fs:read-dir', { path: dirPath }),
    readFile: (filePath: string, maxSize?: number, encoding?: 'utf-8' | 'base64'): Promise<{ success: boolean; content?: string; size?: number; mime?: string; encoding?: string; error?: string }> =>
      ipcRenderer.invoke('fs:read-file', { path: filePath, maxSize, encoding }),
    fileInfo: (filePath: string): Promise<{ success: boolean; exists?: boolean; size?: number; mime?: string; isDir?: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:file-info', { path: filePath }),
    createFile: (filePath: string, content?: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:create-file', { path: filePath, content }),
    createDir: (dirPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:create-dir', { path: dirPath }),
    delete: (targetPath: string, recursive?: boolean): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:delete', { path: targetPath, recursive }),
    rename: (oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:rename', { oldPath, newPath }),
    addRoot: (rootPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:add-root', { path: rootPath }),
    removeRoot: (rootPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:remove-root', { path: rootPath }),
  },

  // Git API
  git: {
    status: (repoPath: string): Promise<{ success: boolean; branch?: string; changedFiles?: GitFileStatus[]; error?: string }> =>
      ipcRenderer.invoke('git:status', { repoPath }),
    branches: (repoPath: string): Promise<{ success: boolean; branches?: string[]; current?: string; error?: string }> =>
      ipcRenderer.invoke('git:branches', { repoPath }),
    diff: (repoPath: string, scope?: string, staged?: boolean): Promise<{ success: boolean; files?: GitDiffFile[]; error?: string }> =>
      ipcRenderer.invoke('git:diff', { repoPath, scope, staged }),
    stage: (repoPath: string, files?: string[]): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('git:stage', { repoPath, files }),
    unstage: (repoPath: string, files?: string[]): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('git:unstage', { repoPath, files }),
    revert: (repoPath: string, files?: string[]): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('git:revert', { repoPath, files }),
    commit: (repoPath: string, message: string): Promise<{ success: boolean; commitHash?: string; error?: string }> =>
      ipcRenderer.invoke('git:commit', { repoPath, message }),
    log: (repoPath: string, maxCount?: number): Promise<{ success: boolean; commits?: GitCommit[]; error?: string }> =>
      ipcRenderer.invoke('git:log', { repoPath, maxCount }),
    show: (repoPath: string, ref: string): Promise<{ success: boolean; diff?: string; error?: string }> =>
      ipcRenderer.invoke('git:show', { repoPath, ref }),
  },

  // Project API
  project: {
    create: (name: string, rootPath: string): Promise<{ success: boolean; project?: ProjectInfo; error?: string }> =>
      ipcRenderer.invoke('project:create', { name, rootPath }),
    list: (): Promise<{ success: boolean; projects?: ProjectInfo[]; error?: string }> =>
      ipcRenderer.invoke('project:list'),
    remove: (projectId: string): Promise<{ success: boolean; deletedSessions?: number; cancelledTasks?: number; error?: string }> =>
      ipcRenderer.invoke('project:remove', { projectId }),
    validate: (rootPath: string): Promise<{ success: boolean; valid?: boolean; exists?: boolean; writable?: boolean; error?: string }> =>
      ipcRenderer.invoke('project:validate', { rootPath }),
  },

  // Terminal API
  terminal: {
    create: (cwd?: string, cols?: number, rows?: number): Promise<{ success: boolean; terminalId?: string; error?: string }> =>
      ipcRenderer.invoke('terminal:create', { cwd, cols, rows }),
    write: (terminalId: string, data: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('terminal:write', { terminalId, data }),
    resize: (terminalId: string, cols: number, rows: number): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('terminal:resize', { terminalId, cols, rows }),
    destroy: (terminalId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('terminal:destroy', { terminalId }),
    onOutput: (cb: (data: { terminalId: string; data: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { terminalId: string; data: string }) => cb(data)
      ipcRenderer.on('terminal:output', listener)
      return () => ipcRenderer.removeListener('terminal:output', listener)
    },
  },

  // Update API
  update: {
    check: (): Promise<{ success: boolean; manifest?: UpdateManifest; error?: string }> =>
      ipcRenderer.invoke('update:check'),
    download: (): Promise<{ success: boolean; manifest?: UpdateManifest; error?: string }> =>
      ipcRenderer.invoke('update:download'),
    install: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('update:install'),
    skipVersion: (version: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('update:skip-version', { version }),
    getStatus: (): Promise<{ success: boolean; status?: UpdateStatus }> =>
      ipcRenderer.invoke('update:get-status'),
    getSettings: (): Promise<{ success: boolean; settings?: UpdateSettings }> =>
      ipcRenderer.invoke('update:get-settings'),
    setSettings: (patch: Partial<UpdateSettings>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('update:set-settings', patch),
    onEvent: (cb: (event: UpdateEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: UpdateEvent) => cb(data)
      ipcRenderer.on('update:event', listener)
      return () => ipcRenderer.removeListener('update:event', listener)
    },
  },

}

contextBridge.exposeInMainWorld('api', api)

export type AttaSeekAPI = typeof api
