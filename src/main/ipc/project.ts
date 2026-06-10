/**
 * IPC handlers for project:* channels.
 * Follows the pattern of session.ts — ipcWrapAsync + validateRequiredString.
 */

import { ipcMain } from 'electron'
import { access, mkdir, rm, rmdir, stat } from 'fs/promises'
import { constants } from 'fs'
import { resolve } from 'path'
import { ipcWrapAsync, validateRequiredString } from '../store/util'
import * as ProjectStore from '../store/ProjectStore'
import { listSessions, deleteSession } from '../store/SessionStore'
import { agentRuntime } from '../agent/AgentRuntime'

export function registerProjectHandlers(): void {
  // ── project:create ─────────────────────────────────────────

  ipcMain.handle('project:create', async (_e, p: { name: string; rootPath: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'name', 'name')
      validateRequiredString(p, 'rootPath', 'rootPath')

      const rootPath = resolve(p.rootPath)

      // Validate directory — distinguish missing vs not-writable
      let exists = false
      try { await access(rootPath, constants.F_OK); exists = true } catch { /* not found */ }
      if (!exists) {
        throw Object.assign(new Error(`目录不存在: ${rootPath}`), { code: 'DIR_NOT_FOUND' })
      }
      try { await access(rootPath, constants.R_OK | constants.W_OK) }
      catch { throw new Error(`目录无读写权限: ${rootPath}`) }

      const project = await ProjectStore.createProject(p.name.trim(), rootPath)
      return { project }
    })
  })

  // ── project:list ───────────────────────────────────────────

  ipcMain.handle('project:list', async () => {
    return ipcWrapAsync(async () => {
      const projects = await ProjectStore.listProjects()
      return { projects }
    })
  })

  // ── project:remove ─────────────────────────────────────────

  ipcMain.handle('project:remove', async (_e, p: { projectId: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'projectId', 'projectId')

      const project = await ProjectStore.getProject(p.projectId)
      if (!project) throw new Error('项目不存在')

      // 1. Cancel all agent tasks for sessions belonging to this project
      const allSessions = await listSessions()
      const projectSessions = allSessions.filter((s) => s.projectId === p.projectId)
      let cancelledCount = 0

      for (const s of projectSessions) {
        const tasks = agentRuntime.listBySession(s.id)
        for (const task of tasks) {
          if (agentRuntime.cancelTask(task.id)) cancelledCount++
        }
      }

      // 2. Delete sessions from global store
      let deletedSessions = 0
      for (const s of projectSessions) {
        try {
          await deleteSession(s.id)
          deletedSessions++
        } catch (err) { console.warn('[project:remove] failed to delete session:', s.id, err instanceof Error ? err.message : String(err)) }
      }

      // 3. Remove project metadata
      await ProjectStore.removeProject(p.projectId)

      // 4. Clean filesystem: remove .atta/seek/ and empty .atta/
      try {
        const seekDir = resolve(project.rootPath, '.atta', 'seek')
        await rm(seekDir, { recursive: true, force: true })
      } catch (err) { console.warn('[project:remove] failed to remove .atta/seek/:', err instanceof Error ? err.message : String(err)) }
      try {
        const attaDir = resolve(project.rootPath, '.atta')
        const files = await stat(attaDir).then(() => true).catch(() => false)
        if (files) {
          // Check if .atta is empty (rmdir fails if not empty)
          await rmdir(attaDir)
        }
      } catch (err) { console.warn('[project:remove] failed to remove .atta/ (may not be empty):', err instanceof Error ? err.message : String(err)) }

      return { success: true, deletedSessions, cancelledTasks: cancelledCount }
    })
  })

  // ── project:validate ───────────────────────────────────────

  ipcMain.handle('project:validate', async (_e, p: { rootPath: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'rootPath', 'rootPath')
      const rootPath = resolve(p.rootPath)
      let exists = false
      let writable = false
      try {
        await access(rootPath, constants.R_OK | constants.W_OK)
        exists = true; writable = true
      } catch {
        try { await access(rootPath, constants.F_OK); exists = true } catch { /* not found */ }
      }
      return { valid: exists && writable, exists, writable }
    })
  })

  console.log('[IPC:project] handlers registered')
}
