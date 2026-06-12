/**
 * GlobalShortcuts — system-wide keyboard shortcuts that work even when
 * the app is not focused. Registered via Electron's globalShortcut API.
 *
 * Default bindings:
 *   Cmd+Shift+G / Ctrl+Shift+G — show/hide AttaSeek windows
 */

import { globalShortcut, BrowserWindow } from 'electron'

const DEFAULT_SHORTCUT = process.platform === 'darwin'
  ? 'Command+Shift+G'
  : 'Ctrl+Shift+G'

function showOrHideAllWindows(): void {
  const allWindows = BrowserWindow.getAllWindows()
  const anyVisible = allWindows.some(w => w.isVisible() && !w.isDestroyed())

  if (anyVisible) {
    // Hide all to tray
    for (const win of allWindows) {
      if (!win.isDestroyed() && win.isVisible()) {
        win.hide()
      }
    }
  } else {
    // Show all (or create if none exist)
    if (allWindows.length === 0) return // handled by activate event
    for (const win of allWindows) {
      if (!win.isDestroyed()) {
        win.show()
        win.focus()
      }
    }
  }
}

let _registered = false

export const GlobalShortcuts = {
  /** Register default global shortcut. Idempotent. */
  register(): void {
    if (_registered) return
    try {
      const ok = globalShortcut.register(DEFAULT_SHORTCUT, () => {
        showOrHideAllWindows()
      })
      if (ok) {
        console.log(`[GlobalShortcuts] registered: ${DEFAULT_SHORTCUT}`)
        _registered = true
      } else {
        console.warn(`[GlobalShortcuts] failed to register: ${DEFAULT_SHORTCUT} (may be taken)`)
      }
    } catch (err) {
      console.warn('[GlobalShortcuts] registration error:', err)
    }
  },

  /** Unregister all global shortcuts. Called on quit. */
  unregister(): void {
    globalShortcut.unregisterAll()
    _registered = false
  },

  /** Get the default shortcut accelerator string. */
  getDefaultAccelerator(): string {
    return DEFAULT_SHORTCUT
  },

  /** Whether the shortcut is currently registered. */
  isRegistered(): boolean {
    return _registered
  },
}
