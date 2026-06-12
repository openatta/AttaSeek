/**
 * PluginIPCProtocol — message types for host ↔ plugin process communication.
 *
 * All messages are JSON-serializable and sent over child_process IPC
 * (process.send / process.on('message')).
 *
 * Direction legend:
 *   H→P  = Host (main process) sends to Plugin (child process)
 *   P→H  = Plugin (child process) sends to Host (main process)
 */

// ── H→P: Host commands the plugin process ──

export interface HostInitMessage {
  type: 'init'
  /** Absolute path to the plugin's plugin.json manifest */
  manifestPath: string
  /** Absolute path to the plugin's installation directory */
  pluginDir: string
}

export interface HostActivateMessage {
  type: 'activate'
}

export interface HostDeactivateMessage {
  type: 'deactivate'
}

export interface HostExecuteToolMessage {
  type: 'executeTool'
  callId: string
  toolName: string
  input: Record<string, unknown>
}

export interface HostShutdownMessage {
  type: 'shutdown'
}

export interface HostHeartbeatResponseMessage {
  type: 'heartbeatResponse'
}

export type HostToPluginMessage =
  | HostInitMessage
  | HostActivateMessage
  | HostDeactivateMessage
  | HostExecuteToolMessage
  | HostShutdownMessage
  | HostHeartbeatResponseMessage

// ── P→H: Plugin process reports back to host ──

export interface PluginReadyMessage {
  type: 'ready'
  /** Contributions the plugin provides (tools, skills, hooks, etc.) */
  contributions: PluginContributionsSnapshot
}

export interface PluginToolResultMessage {
  type: 'toolResult'
  callId: string
  result: {
    success: boolean
    output: unknown
    error?: string
  }
}

export interface PluginToolErrorMessage {
  type: 'toolError'
  callId: string
  error: string
}

export interface PluginHeartbeatMessage {
  type: 'heartbeat'
}

export interface PluginErrorMessage {
  type: 'error'
  error: string
  /** If true, the host should mark the plugin as crashed */
  fatal: boolean
}

export interface PluginLogMessage {
  type: 'log'
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
}

export type PluginToHostMessage =
  | PluginReadyMessage
  | PluginToolResultMessage
  | PluginToolErrorMessage
  | PluginHeartbeatMessage
  | PluginErrorMessage
  | PluginLogMessage

// ── Contribution snapshot ──

/** Serialized plugin contributions sent from child process to host. */
export interface PluginContributionsSnapshot {
  tools?: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
    riskLevel: 'read' | 'modify' | 'risky'
  }>
  skills?: Array<{
    id: string
    name: string
    description: string
  }>
  hooks?: string[]
  mcpServers?: string[]
  agents?: string[]
  renderers?: string[]
  activities?: Array<{
    id: string
    label: string
    icon: string
    order?: number
  }>
  sidebars?: Array<{
    activityId: string
    component: string
    title: string
    order?: number
  }>
}
