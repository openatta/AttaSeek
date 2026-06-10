/**
 * IPC handlers for fs:* channels.
 *
 * Security: all path operations validate against a strict allowlist.
 * Only user home directory and explicitly registered project roots are accessible.
 */

import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'
import { ipcWrapAsync, validateRequiredString } from '../store/util'
import type { DirEntry } from '../../shared/types/ipc'
import { getMimeType } from '../../shared/types/mime'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/** Allowed root directories — paths outside these are rejected */
const allowedRoots = new Set<string>([os.homedir()])

/** Register a new allowed root (e.g., when a project is opened) */
export function addAllowedRoot(root: string): void {
  allowedRoots.add(path.resolve(root))
}

export function removeAllowedRoot(root: string): void {
  allowedRoots.delete(path.resolve(root))
}

/** Validate that a resolved path is within at least one allowed root */
function validatePath(targetPath: string): string {
  const resolved = path.resolve(targetPath)
  for (const root of allowedRoots) {
    const r = path.resolve(root)
    if (resolved === r || resolved.startsWith(r + path.sep)) {
      return resolved
    }
  }
  throw new Error(`Access denied: path "${targetPath}" is outside allowed directories`)
}

export function registerFilesystemHandlers(): void {
  ipcMain.handle('fs:read-dir', async (_e, p: { path: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'path', 'path')
      const dirPath = validatePath(p.path)
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const result: DirEntry[] = await Promise.all(entries.map(async (d) => {
        const fullPath = path.join(dirPath, d.name)
        let size = 0
        let mime: string | undefined
        if (!d.isDirectory()) {
          try { const stat = await fs.stat(fullPath); size = stat.size } catch { /* ignore */ }
          mime = getMimeType(fullPath)
        }
        return { name: d.name, path: fullPath, isDir: d.isDirectory(), size, mime }
      }))
      return { entries: result }
    })
  })

  ipcMain.handle('fs:read-file', async (_e, p: { path: string; maxSize?: number }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'path', 'path')
      const filePath = validatePath(p.path)
      const maxSize = p.maxSize || MAX_FILE_SIZE
      const stat = await fs.stat(filePath)
      if (stat.size > maxSize) {
        throw new Error(`File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB > ${(maxSize / 1024 / 1024).toFixed(0)}MB limit)`)
      }
      const content = await fs.readFile(filePath, 'utf-8')
      const mime = getMimeType(filePath) || 'application/octet-stream'
      return { content, size: stat.size, mime }
    })
  })

  ipcMain.handle('fs:file-info', async (_e, p: { path: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'path', 'path')
      const filePath = validatePath(p.path)
      try {
        const stat = await fs.stat(filePath)
        return {
          exists: true, size: stat.size,
          mime: getMimeType(filePath),
          isDir: stat.isDirectory(),
        }
      } catch {
        return { exists: false, size: 0, mime: undefined, isDir: false }
      }
    })
  })

  ipcMain.handle('fs:create-file', async (_e, p: { path: string; content?: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'path', 'path')
      const filePath = validatePath(p.path)
      await fs.writeFile(filePath, p.content || '', 'utf-8')
      return { success: true }
    })
  })

  ipcMain.handle('fs:create-dir', async (_e, p: { path: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'path', 'path')
      const dirPath = validatePath(p.path)
      await fs.mkdir(dirPath, { recursive: true })
      return { success: true }
    })
  })

  ipcMain.handle('fs:delete', async (_e, p: { path: string; recursive?: boolean }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'path', 'path')
      const target = validatePath(p.path)
      const stat = await fs.stat(target)
      if (stat.isDirectory()) {
        if (p.recursive !== true) {
          throw new Error('Cannot delete directory without recursive flag')
        }
        await fs.rm(target, { recursive: true })
      } else {
        await fs.unlink(target)
      }
      return { success: true }
    })
  })

  ipcMain.handle('fs:rename', async (_e, p: { oldPath: string; newPath: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'oldPath', 'oldPath')
      validateRequiredString(p, 'newPath', 'newPath')
      const oldP = validatePath(p.oldPath)
      const newP = validatePath(p.newPath)
      await fs.rename(oldP, newP)
      return { success: true }
    })
  })

  // fs:add-root → register a new allowed root directory (e.g., when opening a project)
  ipcMain.handle('fs:add-root', async (_e, p: { path: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'path', 'path')
      addAllowedRoot(p.path)
      return { success: true }
    })
  })

  // fs:remove-root → unregister an allowed root directory
  ipcMain.handle('fs:remove-root', async (_e, p: { path: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'path', 'path')
      removeAllowedRoot(p.path)
      return { success: true }
    })
  })

  console.log('[IPC:filesystem] handlers registered')
}
