/**
 * PluginHostEntry — entry point for plugin child processes.
 *
 * This file runs in a forked child_process. It loads the plugin's code,
 * registers contributions, handles tool execution requests, and sends
 * results back to the host process via IPC.
 *
 * Only Node.js built-in APIs and the plugin's own dependencies are available.
 * No Electron, no main-process access, no renderer.
 */

import type {
  HostToPluginMessage,
  PluginToHostMessage,
  PluginContributionsSnapshot,
} from '../PluginIPCProtocol'

// ── State ──

let pluginManifest: Record<string, unknown> | null = null
let pluginDir = ''
let active = false

// ── Message handler ──

process.on('message', async (msg: HostToPluginMessage) => {
  try {
    switch (msg.type) {
      case 'init':
        await handleInit(msg.manifestPath, msg.pluginDir)
        break
      case 'activate':
        await handleActivate()
        break
      case 'deactivate':
        handleDeactivate()
        break
      case 'executeTool':
        await handleExecuteTool(msg.callId, msg.toolName, msg.input)
        break
      case 'shutdown':
        handleShutdown()
        break
      case 'heartbeatResponse':
        // Heartbeat is handled by the host's health monitor
        break
    }
  } catch (err) {
    sendToHost({
      type: 'error',
      error: err instanceof Error ? err.message : 'Unknown error in plugin host',
      fatal: false,
    })
  }
})

// ── Handlers ──

async function handleInit(manifestPath: string, dir: string): Promise<void> {
  pluginDir = dir

  try {
    // Load the plugin manifest
    const fs = await import('fs/promises')
    const raw = await fs.readFile(manifestPath, 'utf-8')
    pluginManifest = JSON.parse(raw)
  } catch (err) {
    sendToHost({
      type: 'error',
      error: `Failed to load plugin manifest: ${(err as Error).message}`,
      fatal: true,
    })
    return
  }

  // Scan contributions from the plugin directory
  const contributions = await scanContributions()

  sendToHost({
    type: 'ready',
    contributions,
  } as PluginToHostMessage)
}

async function handleActivate(): Promise<void> {
  active = true
  sendToHost({ type: 'log', level: 'info', message: 'Plugin activated' })
}

function handleDeactivate(): void {
  active = false
  sendToHost({ type: 'log', level: 'info', message: 'Plugin deactivated' })
}

async function handleExecuteTool(
  callId: string,
  toolName: string,
  input: Record<string, unknown>,
): Promise<void> {
  if (!active) {
    sendToHost({
      type: 'toolError',
      callId,
      error: 'Plugin is not active',
    })
    return
  }

  try {
    // Load the tool implementation from the plugin directory
    const toolPath = `${pluginDir}/main/tools.js`
    let toolModule: Record<string, unknown>

    try {
      toolModule = require(toolPath)
    } catch {
      // Try TypeScript source (development mode)
      try {
        toolModule = require(`${pluginDir}/main/tools`)
      } catch {
        sendToHost({
          type: 'toolError',
          callId,
          error: `Tool module not found at ${toolPath}`,
        })
        return
      }
    }

    const toolFn = (toolModule as Record<string, Function>)[toolName]
    if (typeof toolFn !== 'function') {
      sendToHost({
        type: 'toolError',
        callId,
        error: `Tool "${toolName}" not found in plugin module`,
      })
      return
    }

    const result = await toolFn(input)
    sendToHost({
      type: 'toolResult',
      callId,
      result: { success: true, output: result },
    })
  } catch (err) {
    sendToHost({
      type: 'toolError',
      callId,
      error: err instanceof Error ? err.message : 'Tool execution failed',
    })
  }
}

function handleShutdown(): void {
  active = false
  // Give cleanup time then exit
  setTimeout(() => {
    process.exit(0)
  }, 100)
}

// ── Contribution scanning ──

async function scanContributions(): Promise<PluginContributionsSnapshot> {
  const manifest = pluginManifest || {}
  const manifestRecord = manifest as Record<string, unknown>

  const contributions: PluginContributionsSnapshot = {}

  // Extract skills from manifest
  if (Array.isArray(manifestRecord.skills)) {
    contributions.skills = manifestRecord.skills as PluginContributionsSnapshot['skills']
  }

  // Extract tool names from manifest (actual definitions loaded on-demand)
  if (Array.isArray(manifestRecord.tools)) {
    contributions.tools = (manifestRecord.tools as string[]).map((name: string) => ({
      name,
      description: `Plugin tool: ${name}`,
      inputSchema: { type: 'object', properties: {} },
      riskLevel: 'modify' as const,
    }))
  }

  // Extract other contributions
  if (Array.isArray(manifestRecord.hooks)) {
    contributions.hooks = manifestRecord.hooks as string[]
  }
  if (Array.isArray(manifestRecord.mcpServers)) {
    contributions.mcpServers = manifestRecord.mcpServers as string[]
  }
  if (Array.isArray(manifestRecord.agents)) {
    contributions.agents = manifestRecord.agents as string[]
  }
  if (Array.isArray(manifestRecord.renderers)) {
    contributions.renderers = manifestRecord.renderers as string[]
  }
  if (Array.isArray(manifestRecord.activityEntries)) {
    contributions.activities = manifestRecord.activityEntries as PluginContributionsSnapshot['activities']
  }
  if (Array.isArray(manifestRecord.sidebarViews)) {
    contributions.sidebars = manifestRecord.sidebarViews as PluginContributionsSnapshot['sidebars']
  }

  return contributions
}

// ── Helpers ──

function sendToHost(msg: PluginToHostMessage): void {
  if (process.send) {
    process.send(msg)
  }
}

// Heartbeat
const HEARTBEAT_INTERVAL_MS = 10_000
setInterval(() => {
  sendToHost({ type: 'heartbeat' })
}, HEARTBEAT_INTERVAL_MS)

// Notify parent we're alive
sendToHost({ type: 'log', level: 'info', message: 'Plugin host started' })
