import { ipcMain } from 'electron'
import { artifactService } from '../artifacts/ArtifactService'
import { ipcWrap } from '../store/util'

export function registerArtifactHandlers(): void {
  ipcMain.handle('artifact:list', async (_e, p: { sessionId: string }) =>
    ipcWrap(() => ({ artifacts: artifactService.listBySession(p.sessionId) })))
  ipcMain.handle('artifact:get', async (_e, p: { artifactId: string }) =>
    ipcWrap(() => ({ artifact: artifactService.get(p.artifactId) || null })))
  ipcMain.handle('artifact:update', async (_e, p: { artifactId: string; patch: { content?: string; title?: string } }) =>
    ipcWrap(() => ({ artifact: artifactService.update(p.artifactId, p.patch) || null })))
  console.log('[IPC:artifact] handlers registered')
}
