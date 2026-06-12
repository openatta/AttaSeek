/**
 * Tray icon shared types — used across main process, preload, and renderer.
 */

/** Tray-specific settings persisted in settings.json */
export interface TrayConfig {
  minimizeToTray: boolean
  autoLaunch: boolean
  startMinimized: boolean
  firstMinimizeNotified: boolean
}

/** IPC response for tray:get-settings */
export interface TraySettingsResponse {
  success: boolean
  settings?: TrayConfig
}

/** IPC request for tray:set-settings */
export type TraySettingsPatch = Partial<TrayConfig>

/** IPC response for tray:platform-info */
export interface TrayPlatformInfo {
  trayAvailable: boolean
  platform: NodeJS.Platform
}

/** IPC push payload for tray:navigate */
export interface TrayNavigateEvent {
  sessionId: string
}
