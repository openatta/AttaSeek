/**
 * IPC Channel Version Registry.
 *
 * Tracks all IPC channels, their introduction version, deprecation status,
 * and replacement channels. Enforces the IPC compatibility policy:
 *
 * - New channels: add directly.
 * - Deprecated channels: mark with @deprecated, keep for 1 release cycle.
 * - Breaking changes: create a new channel, keep old channel.
 * - Never change the request/response shape of an existing channel.
 */

export interface ChannelInfo {
  channel: string
  since: string        // version when introduced
  deprecated?: string  // version when deprecated (if applicable)
  replacedBy?: string  // replacement channel
  direction: 'renderer->main' | 'main->renderer' | 'bidirectional'
}

/** Master channel registry — edit when adding/deprecating channels */
export const CHANNEL_REGISTRY: ChannelInfo[] = [
  // Theme
  { channel: 'theme:get', since: '0.1.0', direction: 'renderer->main' },
  { channel: 'theme:set', since: '0.1.0', direction: 'renderer->main' },
  { channel: 'theme:system-changed', since: '0.1.0', direction: 'main->renderer' },

  // Agent
  { channel: 'agent:create-task', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'agent:cancel-task', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'agent:get-task', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'agent:list-events', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'agent:event', since: '0.2.0', direction: 'main->renderer' },

  // Artifact
  { channel: 'artifact:list', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'artifact:get', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'artifact:update', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'artifact:created', since: '0.2.0', direction: 'main->renderer' },
  { channel: 'artifact:updated', since: '0.2.0', direction: 'main->renderer' },

  // Permission
  { channel: 'permission:respond', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'permission:request', since: '0.2.0', direction: 'main->renderer' },
  { channel: 'permission:list-policies', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'permission:update-policy', since: '0.2.0', direction: 'renderer->main' },

  // Registry / Settings
  { channel: 'skill:list', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'tool:list', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'plugin:list', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'memory:list', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'memory:store', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'memory:delete', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'audit:list', since: '0.2.0', direction: 'renderer->main' },

  // Model config (added 0.4.0)
  { channel: 'model:list', since: '0.4.0', direction: 'renderer->main' },
  { channel: 'model:get', since: '0.4.0', direction: 'renderer->main' },
  { channel: 'model:create', since: '0.4.0', direction: 'renderer->main' },
  { channel: 'model:update', since: '0.4.0', direction: 'renderer->main' },
  { channel: 'model:delete', since: '0.4.0', direction: 'renderer->main' },
  { channel: 'model:set-default', since: '0.4.0', direction: 'renderer->main' },
  { channel: 'model:test', since: '0.4.0', direction: 'renderer->main' },
  { channel: 'model:usage', since: '0.4.0', direction: 'renderer->main' },
  { channel: 'model:get-key-info', since: '0.4.0', direction: 'renderer->main' },
  { channel: 'model:has-config', since: '0.4.0', direction: 'renderer->main' },

  // Session (added 0.3.0)
  { channel: 'session:create', since: '0.3.0', direction: 'renderer->main' },
  { channel: 'session:list', since: '0.3.0', direction: 'renderer->main' },
  { channel: 'session:get', since: '0.3.0', direction: 'renderer->main' },
  { channel: 'session:update', since: '0.3.0', direction: 'renderer->main' },
  { channel: 'session:delete', since: '0.3.0', direction: 'renderer->main' },
  { channel: 'session:save-events', since: '0.3.0', direction: 'renderer->main' },
  { channel: 'session:load-events', since: '0.3.0', direction: 'renderer->main' },
  { channel: 'session:updated', since: '0.3.0', direction: 'main->renderer' },

  // App state
  { channel: 'app:get-state', since: '0.2.0', direction: 'renderer->main' },
  { channel: 'app:set-state', since: '0.2.0', direction: 'renderer->main' },
]

/** Get channels that are deprecated (used during IPC cleanup passes) */
export function getDeprecatedChannels(): ChannelInfo[] {
  return CHANNEL_REGISTRY.filter((c) => c.deprecated)
}

/** Get channels matching a filter (used for diagnostics) */
export function queryChannels(filter: Partial<Pick<ChannelInfo, 'since' | 'direction'>>): ChannelInfo[] {
  return CHANNEL_REGISTRY.filter((c) => {
    if (filter.since && c.since !== filter.since) return false
    if (filter.direction && c.direction !== filter.direction) return false
    return true
  })
}

/** Validate that a channel name follows the `feature:action` convention */
export function isValidChannelName(channel: string): boolean {
  return /^[a-z][a-z-]*:[a-z][a-z-]*$/.test(channel)
}
