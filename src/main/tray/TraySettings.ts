/**
 * TraySettings — thin read/write facade over ConfigManager for tray-specific settings.
 */

import { getSetting, setSetting } from '../config/ConfigManager'
import type { TrayConfig } from '../../shared/types/tray'

const KEYS = {
  minimizeToTray: 'tray.minimizeToTray' as const,
  autoLaunch: 'tray.autoLaunch' as const,
  startMinimized: 'tray.startMinimized' as const,
  firstMinimizeNotified: 'tray.firstMinimizeNotified' as const,
}

export const TraySettings = {
  async get(): Promise<TrayConfig> {
    const [minimizeToTray, autoLaunch, startMinimized, firstMinimizeNotified] = await Promise.all([
      getSetting(KEYS.minimizeToTray),
      getSetting(KEYS.autoLaunch),
      getSetting(KEYS.startMinimized),
      getSetting(KEYS.firstMinimizeNotified),
    ])
    return {
      minimizeToTray: minimizeToTray as boolean,
      autoLaunch: autoLaunch as boolean,
      startMinimized: startMinimized as boolean,
      firstMinimizeNotified: firstMinimizeNotified as boolean,
    }
  },

  async update(patch: Partial<TrayConfig>): Promise<void> {
    const promises: Promise<void>[] = []
    if (patch.minimizeToTray !== undefined) promises.push(setSetting(KEYS.minimizeToTray, patch.minimizeToTray))
    if (patch.autoLaunch !== undefined) promises.push(setSetting(KEYS.autoLaunch, patch.autoLaunch))
    if (patch.startMinimized !== undefined) promises.push(setSetting(KEYS.startMinimized, patch.startMinimized))
    if (patch.firstMinimizeNotified !== undefined) promises.push(setSetting(KEYS.firstMinimizeNotified, patch.firstMinimizeNotified))
    await Promise.all(promises)
  },

  async isMinimizeToTrayEnabled(): Promise<boolean> {
    return (await getSetting(KEYS.minimizeToTray)) as boolean
  },
}
