/**
 * IPC handlers for model:* channels.
 * Model config CRUD, testing, and usage stats.
 */

import { ipcMain } from 'electron'
import { modelConfigService } from '../model/ModelConfigService'
import { modelUsageTracker } from '../model/ModelUsageTracker'
import { ipcWrap, ipcWrapAsync, validateRequiredString } from '../store/util'
import type { CreateModelConfig, ModelConfigPatch, ModelTestResult, UsageStats } from '../../shared/types/model'

export function registerModelHandlers(): void {
  ipcMain.handle('model:list', async () =>
    ipcWrap(() => ({ configs: modelConfigService.listAll() })))

  ipcMain.handle('model:get', async (_e, p: { id: string }) =>
    ipcWrap(() => {
      if (!p.id || typeof p.id !== 'string') throw new Error('id must be a string')
      return { config: modelConfigService.get(p.id) }
    }))

  ipcMain.handle('model:create', async (_e, p: { config: CreateModelConfig }) =>
    ipcWrap(() => {
      const c = p.config
      if (!c || typeof c !== 'object') throw new Error('config is required')
      const raw = c as unknown as Record<string, unknown>
      validateRequiredString(raw, 'name', 'name')
      validateRequiredString(raw, 'interfaceType', 'interfaceType')
      validateRequiredString(raw, 'endpointUrl', 'endpointUrl')
      validateRequiredString(raw, 'apiKey', 'apiKey')
      validateRequiredString(raw, 'defaultModel', 'defaultModel')
      const config = modelConfigService.create({
        name: c.name,
        interfaceType: c.interfaceType,
        endpointUrl: c.endpointUrl,
        apiKey: c.apiKey,
        defaultModel: c.defaultModel,
        models: Array.isArray(c.models) ? c.models : [c.defaultModel],
        extraParams: c.extraParams,
        opusModel: c.opusModel,
        sonnetModel: c.sonnetModel,
        haikuModel: c.haikuModel,
        smallFastModel: c.smallFastModel,
        subagentModel: c.subagentModel,
        strongModel: c.strongModel,
        fallbackModel: c.fallbackModel,
        classifierModel: c.classifierModel,
        compactModel: c.compactModel,
        effortLevel: c.effortLevel,
        maxTokens: c.maxTokens,
        compactThreshold: c.compactThreshold,
        interfaces: c.interfaces,
      })
      return { config }
    }))

  ipcMain.handle('model:update', async (_e, p: { id: string; patch: ModelConfigPatch }) =>
    ipcWrap(() => {
      if (!p.id || typeof p.id !== 'string') throw new Error('id must be a string')
      return { config: modelConfigService.update(p.id, p.patch as Parameters<typeof modelConfigService.update>[1]) }
    }))

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
      return result as unknown as Record<string, unknown>
    }))

  ipcMain.handle('model:usage', async (_e, p: { configId?: string; periodDays?: number }) =>
    ipcWrapAsync(async (): Promise<{ stats: UsageStats }> => ({ stats: await modelUsageTracker.summary(p.configId, p.periodDays) })))

  ipcMain.handle('model:has-config', async () =>
    ipcWrap(() => ({ configured: modelConfigService.hasConfigured() })))

  console.log('[IPC:model] handlers registered')
}
