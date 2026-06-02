import { contextBridge, ipcRenderer } from 'electron'

// Minimal secure API surface exposed to the renderer process.
// All system capabilities go through here — the renderer never
// accesses Node.js or Electron APIs directly.
const api = {
  platform: process.platform,
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',

  // IPC stubs — expand as features are built
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type AttaSeekAPI = typeof api
