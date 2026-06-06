/**
 * IPC handlers for model:* channels.
 * Model config CRUD, testing, and usage stats.
 */

import { ipcMain } from 'electron'
import { modelConfigService } from '../model/ModelConfigService'
import { modelUsageTracker } from '../model/ModelUsageTracker'
import { getApiKeyPreview } from '../store/secrets'
import { ipcWrap, ipcWrapAsync, validateStringField } from '../store/util'

export function registerModelHandlers(): void {
  ipcMain.handle('model:list', async () =>
    ipcWrap(() => ({ configs: modelConfigService.listAll() })))

  ipcMain.handle('model:get', async (_e, p: { id: string }) => {
    if (!p.id || typeof p.id !== 'string') throw new Error('id must be a string')
    return ipcWrap(() => ({ config: modelConfigService.get(p.id) }))
  })

  ipcMain.handle('model:create', async (_e, p: { config: Record<string, unknown> }) =>
    ipcWrap(() => {
      const c = p.config
      if (!c || typeof c !== 'object') throw new Error('config is required')
      validateStringField(c, 'name', 'name')
      validateStringField(c, 'interfaceType', 'interfaceType')
      validateStringField(c, 'endpointUrl', 'endpointUrl')
      validateStringField(c, 'apiKey', 'apiKey')
      validateStringField(c, 'defaultModel', 'defaultModel')
      const config = modelConfigService.create(c as any)
      return { config }
    }))

  ipcMain.handle('model:update', async (_e, p: { id: string; patch: Record<string, unknown> }) => {
    if (!p.id || typeof p.id !== 'string') throw new Error('id must be a string')
    return ipcWrap(() => ({ config: modelConfigService.update(p.id, p.patch as any) }))
  })

  ipcMain.handle('model:delete', async (_e, p: { id: string }) =>
    ipcWrap(() => {
      const result = modelConfigService.delete(p.id)
      return { success: result.success, needNewDefault: result.needNewDefault }
    }))

  ipcMain.handle('model:set-default', async (_e, p: { id: string }) =>
    ipcWrap(() => ({ success: modelConfigService.setDefault(p.id) })))

  ipcMain.handle('model:test', async (_e, p: { id: string }) =>
    ipcWrapAsync(async () => {
      const result = await modelConfigService.test(p.id)
      return result
    }))

  ipcMain.handle('model:usage', async (_e, p: { configId?: string; periodDays?: number }) =>
    ipcWrap(() => ({ stats: modelUsageTracker.summary(p.configId, p.periodDays) })))

  ipcMain.handle('model:get-key-info', async (_e, p: { id: string }) =>
    ipcWrap(() => ({ info: getApiKeyPreview(`model:${p.id}`) })))

  ipcMain.handle('model:has-config', async () =>
    ipcWrap(() => ({ configured: modelConfigService.hasConfigured() })))

  console.log('[IPC:model] handlers registered')
}
