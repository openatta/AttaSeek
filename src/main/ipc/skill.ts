import { ipcMain } from 'electron'
import { skillRegistry } from '../skills/SkillRegistry'

export function registerSkillHandlers(): void {
  ipcMain.handle('skill:list', async () => {
    return { skills: skillRegistry.list() }
  })

  console.log('[IPC:skill] handlers registered')
}
