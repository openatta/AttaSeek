/**
 * Mock window.api for Playwright browser-based E2E tests.
 *
 * Injects a fully-typed mock of the AttaSeek preload API so that the renderer
 * can run in a regular Chromium browser without Electron. All IPC calls return
 * realistic mock data; agent event streaming is simulated via stored callbacks.
 *
 * Usage in test:
 *   await page.addInitScript({ path: './e2e/fixtures/mock-api.js' });
 *
 * The mock is compiled to JS via `npx tsc` before tests run, or loaded as a
 * plain JS file that sets up window.api synchronously before React mounts.
 */

import type { SessionInfo, AgentTask } from '../src/shared/types/AgentTask'
import type { SessionEvent } from '../src/shared/types/SessionEvent'
import type { ModelConfig } from '../src/shared/types/model'

// ── In-memory stores (reset per test via window.__mockReset__) ──

declare global {
  interface Window {
    api: typeof mockApi
    __mockReset__: () => void
    __mockEmitEvent__: (event: SessionEvent) => void
    __mockGetEvents__: () => SessionEvent[]
    __mockSetScenarios__: (scenarios: SessionEvent[][]) => void
  }
}

let sessions: SessionInfo[] = []
let events: Record<string, SessionEvent[]> = {}
let tasks: AgentTask[] = []
let modelConfigs: ModelConfig[] = []
let eventListeners: Array<(event: SessionEvent) => void> = []
let sessionUpdateListeners: Array<(data: { id: string; title: string }) => void> = []
let currentScenarios: SessionEvent[][] = []
let scenarioIndex = 0

// ── ID generators ──

let _idCounter = 0
function newId(): string {
  return `mock_${Date.now()}_${++_idCounter}`
}

// ── Reset function ──

function resetAll(): void {
  sessions = []
  events = {}
  tasks = []
  modelConfigs = [
    {
      id: 'mock-model-1',
      name: 'Mock Model',
      interfaceType: 'openai_compatible' as const,
      endpointUrl: 'http://localhost:19999/v1',
      models: ['mock-model'],
      defaultModel: 'mock-model',
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]
  eventListeners = []
  sessionUpdateListeners = []
  currentScenarios = []
  scenarioIndex = 0
  _idCounter = 0
}

// ── Scenario runner ──

function runNextScenario(): void {
  if (scenarioIndex >= currentScenarios.length) return
  const scenarioEvents = currentScenarios[scenarioIndex++]
  if (!scenarioEvents) return

  let delay = 0
  for (const event of scenarioEvents) {
    setTimeout(() => {
      const evt = { ...event, id: event.id || newId(), createdAt: event.createdAt || Date.now() }
      // Persist to mock store
      if (!events[evt.sessionId]) events[evt.sessionId] = []
      events[evt.sessionId].push(evt)

      // Notify listeners
      for (const cb of eventListeners) {
        try { cb(evt) } catch (e) { console.warn('[mock-api] listener error:', e) }
      }
    }, delay)
    delay += 50 // stagger events
  }
}

// ── Mock API ──

const mockApi = {
  platform: 'darwin' as const,
  isMac: true,
  isWindows: false,
  isLinux: false,

  theme: {
    get: async (): Promise<{ theme: string }> => ({ theme: 'dark' }),
    set: async (_theme: string): Promise<{ success: boolean }> => ({ success: true }),
    onSystemChange: (cb: (theme: 'dark' | 'light') => void) => {
      return () => {} // no-op unsubscribe
    },
  },

  agent: {
    createTask: async (
      goal: string,
      sessionId: string,
      _projectId?: string,
      _modelConfigId?: string,
      _modelName?: string,
      _language?: string,
    ): Promise<{ success: boolean; task?: AgentTask; error?: string }> => {
      const task: AgentTask = {
        id: newId(),
        sessionId,
        goal,
        status: 'executing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      tasks.push(task)

      // Auto-create session if not exists
      if (!sessions.find(s => s.id === sessionId)) {
        const session: SessionInfo = {
          id: sessionId,
          title: goal.slice(0, 60),
          activity: 'chat',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        sessions.unshift(session)
        // Notify sidebar
        for (const cb of sessionUpdateListeners) {
          try { cb({ id: session.id, title: session.title }) } catch {}
        }
      }

      if (!events[sessionId]) events[sessionId] = []

      // Emit UserMessage event
      const userEvent: SessionEvent = {
        id: newId(),
        sessionId,
        taskId: task.id,
        type: 'UserMessage',
        payload: { content: goal },
        createdAt: Date.now(),
      }
      events[sessionId].push(userEvent)
      for (const cb of eventListeners) {
        try { cb(userEvent) } catch {}
      }

      // Run scenario-based events
      runNextScenario()

      return { success: true, task }
    },

    cancelTask: async (_taskId: string): Promise<{ success: boolean }> => {
      const task = tasks.find(t => t.id === _taskId)
      if (task) {
        task.status = 'cancelled'
        task.updatedAt = Date.now()
      }
      return { success: true }
    },

    getTask: async (_taskId: string): Promise<{ task: AgentTask | null }> => {
      return { task: tasks.find(t => t.id === _taskId) || null }
    },

    listEvents: async (sessionId: string): Promise<{ events: SessionEvent[] }> => {
      return { events: events[sessionId] || [] }
    },

    onEvent: (cb: (event: SessionEvent) => void) => {
      eventListeners.push(cb)
      return () => {
        eventListeners = eventListeners.filter(l => l !== cb)
      }
    },
  },

  artifact: {
    list: async (_sessionId: string): Promise<{ artifacts: any[] }> => ({ artifacts: [] }),
    get: async (_artifactId: string): Promise<{ artifact: any | null }> => ({ artifact: null }),
    update: async (_artifactId: string, _patch: any): Promise<{ artifact: any | null }> => ({ artifact: null }),
  },

  skill: {
    list: async (): Promise<{ skills: any[] }> => ({ skills: [] }),
  },

  tool: {
    list: async (): Promise<{ tools: any[] }> => ({ tools: [] }),
  },

  permission: {
    respond: async (_requestId: string, _decision: string): Promise<{ success: boolean }> => ({ success: true }),
    listPolicies: async (): Promise<{ policies: any[] }> => ({ policies: [] }),
    updatePolicy: async (_id: string, _decision: string): Promise<{ success: boolean }> => ({ success: true }),
  },

  memory: {
    list: async (_filters?: any): Promise<{ entries: any[] }> => ({ entries: [] }),
    store: async (_entry: any): Promise<{ entry: any }> => ({ entry: {} }),
    delete: async (_id: string): Promise<{ success: boolean }> => ({ success: true }),
  },

  audit: {
    list: async (_filters?: any): Promise<{ logs: any[] }> => ({ logs: [] }),
  },

  model: {
    list: async (): Promise<{ configs: ModelConfig[] }> => ({ configs: modelConfigs }),
    create: async (config: any): Promise<{ config: ModelConfig }> => {
      const c: ModelConfig = { ...config, id: newId(), createdAt: Date.now(), updatedAt: Date.now(), isDefault: modelConfigs.length === 0 }
      modelConfigs.push(c)
      return { config: c }
    },
    get: async (id: string): Promise<{ config: ModelConfig | null }> => {
      return { config: modelConfigs.find(c => c.id === id) || null }
    },
    update: async (id: string, _patch: any): Promise<{ config: ModelConfig | null }> => {
      const c = modelConfigs.find(c => c.id === id)
      if (c) { Object.assign(c, _patch); c.updatedAt = Date.now() }
      return { config: c || null }
    },
    delete: async (_id: string): Promise<{ success: boolean; needNewDefault?: boolean }> => {
      modelConfigs = modelConfigs.filter(c => c.id !== _id)
      return { success: true }
    },
    setDefault: async (_id: string): Promise<{ success: boolean }> => {
      modelConfigs.forEach(c => { c.isDefault = c.id === _id })
      return { success: true }
    },
    test: async (_id: string): Promise<any> => ({ success: true }),
    usage: async (_configId?: string, _periodDays?: number): Promise<{ stats: any }> => ({ stats: {} }),
    hasConfig: async (): Promise<{ configured: boolean }> => ({ configured: modelConfigs.length > 0 }),
  },

  session: {
    create: async (title?: string, activity?: string, id?: string): Promise<{ session: SessionInfo }> => {
      const s: SessionInfo = {
        id: id || newId(),
        title: title || 'New Session',
        activity: activity || 'chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      sessions.unshift(s)
      return { session: s }
    },
    list: async (_activity?: string): Promise<{ sessions: SessionInfo[] }> => {
      return { sessions: _activity ? sessions.filter(s => s.activity === _activity) : sessions }
    },
    get: async (id: string): Promise<{ session: SessionInfo | null }> => {
      return { session: sessions.find(s => s.id === id) || null }
    },
    update: async (id: string, patch: { title?: string }): Promise<{ session: SessionInfo | null }> => {
      const s = sessions.find(s => s.id === id)
      if (s) {
        if (patch.title) s.title = patch.title
        s.updatedAt = Date.now()
        // Notify sidebar listeners
        for (const cb of sessionUpdateListeners) {
          try { cb({ id, title: s.title }) } catch {}
        }
      }
      return { session: s || null }
    },
    delete: async (id: string): Promise<{ success: boolean }> => {
      sessions = sessions.filter(s => s.id !== id)
      delete events[id]
      return { success: true }
    },
    onUpdate: (cb: (data: { id: string; title: string }) => void) => {
      sessionUpdateListeners.push(cb)
      return () => {
        sessionUpdateListeners = sessionUpdateListeners.filter(l => l !== cb)
      }
    },
  },

  plugin: {
    list: async (): Promise<{ plugins: any[] }> => ({ plugins: [] }),
  },

  question: {
    respond: async (_questionId: string, _answer: string): Promise<{ success: boolean }> => ({ success: true }),
  },

  app: {
    getState: async (_key: string): Promise<{ success: boolean; value: string | null }> => ({ success: false, value: null }),
    setState: async (_key: string, _value: string): Promise<{ success: boolean }> => ({ success: true }),
  },
}

// ── Inject into window ──

if (typeof window !== 'undefined') {
  resetAll()
  ;(window as any).api = mockApi
  ;(window as any).__mockReset__ = resetAll
  ;(window as any).__mockEmitEvent__ = (event: SessionEvent) => {
    if (!events[event.sessionId]) events[event.sessionId] = []
    events[event.sessionId].push(event)
    for (const cb of eventListeners) {
      try { cb(event) } catch {}
    }
  }
  ;(window as any).__mockGetEvents__ = () => {
    const all: SessionEvent[] = []
    for (const key of Object.keys(events)) {
      all.push(...events[key])
    }
    return all
  }
  ;(window as any).__mockSetScenarios__ = (scenarios: SessionEvent[][]) => {
    currentScenarios = scenarios
    scenarioIndex = 0
  }
}
