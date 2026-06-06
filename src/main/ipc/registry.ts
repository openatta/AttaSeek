/**
 * Generic IPC handlers for registry-backed list operations.
 * Consolidates tool:list, plugin:list, and skill:list into a shared pattern.
 */

import { ipcMain } from 'electron'
import { toolRegistry } from '../tools/ToolRegistry'
import { pluginRegistry } from '../plugins/PluginRegistry'
import { skillRegistry } from '../skills/SkillRegistry'
import { ipcWrap } from '../store/util'

interface Listable<T> { list(): T[] }

function registerListHandler<T>(channel: string, registry: Listable<T>, resultKey: string, label: string): void {
  ipcMain.handle(channel, async () => ipcWrap(() => ({ [resultKey]: registry.list() })))
  console.log(`[IPC:${label}] handlers registered`)
}

export function registerToolHandlers(): void {
  registerListHandler('tool:list', toolRegistry, 'tools', 'tool')
}

export function registerPluginHandlers(): void {
  registerListHandler('plugin:list', pluginRegistry, 'plugins', 'plugin')
}

export function registerSkillHandlers(): void {
  registerListHandler('skill:list', skillRegistry, 'skills', 'skill')
}
