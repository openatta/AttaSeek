/**
 * SandboxManager — path + command interception for Agent safety.
 *
 * Soft sandbox: validates paths and commands against config rules.
 * Default: project directory read/write; privacy paths blocked; network allowed.
 */

import { getSetting } from '../config/ConfigManager'
import { app } from 'electron'
import { join, resolve, relative } from 'path'

const PRIVACY_DIRS = ['.ssh', '.gnupg', '.aws', '.npmrc', '.gitconfig']

export interface SandboxCheck { allowed: boolean; reason?: string }

function expandPath(p: string): string {
  if (p === 'project') return process.cwd()
  return p.replace(/^~/, app.getPath('home'))
}

export async function checkPath(pathStr: string, operation: 'read' | 'write'): Promise<SandboxCheck> {
  const sandbox = await getSetting('sandbox')
  const resolved = resolve(pathStr)
  const home = app.getPath('home')

  // Blocked paths
  for (const bp of sandbox.blockedPaths) {
    if (resolved.startsWith(expandPath(bp))) {
      return { allowed: false, reason: `Path blocked by sandbox: ${bp}` }
    }
  }

  // Privacy dirs in home
  for (const pd of PRIVACY_DIRS) {
    if (resolved.startsWith(join(home, pd))) {
      return { allowed: false, reason: `Privacy path blocked: ${pd}` }
    }
  }

  if (sandbox.mode === 'danger-full-access') return { allowed: true }

  // Read-only mode: allow read everywhere except blocked
  if (sandbox.mode === 'read-only' && operation === 'read') return { allowed: true }
  if (sandbox.mode === 'read-only' && operation === 'write') {
    return { allowed: false, reason: 'Sandbox mode is read-only. Change to workspace-write in Settings to allow writes.' }
  }

  // Workspace-write: write only in writable roots
  if (sandbox.mode === 'workspace-write' && operation === 'write') {
    for (const root of sandbox.writableRoots) {
      if (resolved.startsWith(expandPath(root))) return { allowed: true }
    }
    return { allowed: false, reason: `Write to ${pathStr} not allowed in workspace-write mode. Add path to sandbox.writableRoots in Settings.` }
  }

  return { allowed: true }
}

export async function checkCommand(command: string): Promise<SandboxCheck> {
  const sandbox = await getSetting('sandbox')
  const bash = sandbox.bash

  if (bash.mode === 'whitelist') {
    const cmdName = command.split(/\s+/)[0]
    if (!bash.allowedCommands.includes(cmdName)) {
      return { allowed: false, reason: `Command "${cmdName}" not in whitelist` }
    }
    return { allowed: true }
  }

  for (const pattern of bash.blockedPatterns) {
    if (command.includes(pattern)) {
      return { allowed: false, reason: `Command blocked by pattern: "${pattern}"` }
    }
  }
  return { allowed: true }
}

export async function checkBash(input: { command: string; cwd?: string; needsNetwork?: boolean }): Promise<SandboxCheck> {
  const sandbox = await getSetting('sandbox')
  if (input.needsNetwork && !sandbox.networkAccess) {
    return { allowed: false, reason: 'Network access disabled in sandbox' }
  }
  if (input.cwd) {
    const pathCheck = await checkPath(input.cwd, 'read')
    if (!pathCheck.allowed) return pathCheck
  }
  return checkCommand(input.command)
}
