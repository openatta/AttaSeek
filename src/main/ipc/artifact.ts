import { ipcMain } from 'electron'
import { artifactService } from '../artifacts/ArtifactService'

export function registerArtifactHandlers(): void {
  ipcMain.handle('artifact:list', async (_event, params: { sessionId: string }) => {
    const artifacts = artifactService.listBySession(params.sessionId)
    return { artifacts }
  })

  ipcMain.handle('artifact:get', async (_event, params: { artifactId: string }) => {
    const artifact = artifactService.get(params.artifactId)
    return { artifact: artifact || null }
  })

  ipcMain.handle('artifact:update', async (_event, params: { artifactId: string; patch: { content?: string; title?: string } }) => {
    const artifact = artifactService.update(params.artifactId, params.patch)
    return { artifact: artifact || null }
  })

  console.log('[IPC:artifact] handlers registered')
}
