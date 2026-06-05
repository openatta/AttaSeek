import { ipcMain } from 'electron'
import { skillRegistry } from '../skills/SkillRegistry'
import { ipcWrap } from '../store/util'

export function registerSkillHandlers(): void {
  ipcMain.handle('skill:list', async () => ipcWrap(() => ({ skills: skillRegistry.list() })))
  console.log('[IPC:skill] handlers registered')
}
