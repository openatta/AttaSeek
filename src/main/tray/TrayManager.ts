/**
 * TrayManager — system tray icon lifecycle, context menu, window show/hide.
 *
 * Singleton. Created once at app startup, destroyed on quit.
 *
 * TODO(i18n): Native menu labels are currently hardcoded in Chinese.
 * When main-process i18n is available, extract menu labels to a shared
 * locale module. For now, see TRAY_LABELS below for all user-facing strings.
 */

import { Tray, Menu, MenuItem, nativeImage, BrowserWindow, app, Notification, dialog } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { TraySettings } from './TraySettings'
import { AutoLauncher } from './AutoLauncher'
import { listSessions } from '../store/SessionStore'
import { agentRuntime } from '../agent/AgentRuntime'
import { t, setLocale, type Locale } from '../../shared/i18n'
import { dataDir } from '../store/paths'

const isMac = process.platform === 'darwin'

/** Read user language preference from app_state.json. Falls back to 'zh'. */
function loadLocale(): Locale {
  try {
    const path = `${dataDir()}/app_state.json`
    if (!existsSync(path)) return 'zh'
    const raw = readFileSync(path, 'utf-8')
    const data = JSON.parse(raw) as Record<string, unknown>
    const lang = data['language']
    if (lang === 'en' || lang === 'zh') return lang
    return 'zh'
  } catch {
    return 'zh'
  }
}

/** Create a simple 16×16 tray icon programmatically (fallback until resource files exist).
 *  Generates a small purple-tinted dot icon via a minimal embedded PNG. */
function createFallbackIcon(): Electron.NativeImage {
  // Tiny 4×4 purple-tinted PNG. Minimal fallback — replace with resources/tray-icon.png.
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQImWNkYGD4z0ABYKS7AkwMDH9ZqCgfoDkGKssHaA4AElgBH9mh6nIAAAAASUVORK5CYII='
  const img = nativeImage.createFromDataURL(`data:image/png;base64,${pngBase64}`)
  return img.resize({ width: 16, height: 16 })
}

function loadTrayIcon(): Electron.NativeImage {
  // Try template icon first (macOS), then platform-specific, fall back to generated
  const resourceDir = join(__dirname, '../../resources')
  if (isMac) {
    const templatePath = join(resourceDir, 'tray-iconTemplate.png')
    try {
      const img = nativeImage.createFromPath(templatePath)
      if (!img.isEmpty()) {
        img.setTemplateImage(true)
        return img.resize({ width: 16, height: 16 })
      }
    } catch { /* fallback */ }
  }
  // Generic fallback
  try {
    const img = nativeImage.createFromPath(join(resourceDir, 'tray-icon.png'))
    if (!img.isEmpty()) return img.resize({ width: isMac ? 16 : 32, height: isMac ? 16 : 32 })
  } catch { /* fallback */ }
  return createFallbackIcon()
}

interface CachedSession {
  id: string
  title: string
}

export class TrayManager {
  private tray: Tray | null = null
  private trayAvailable = true
  private cachedSessions: CachedSession[] = []
  private hiddenWindows = new Set<number>()
  private sessionCacheDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private minimizeNotifiedFlag = false

  /** Create the tray icon and initial menu. */
  async create(): Promise<void> {
    const icon = loadTrayIcon()
    try {
      this.tray = new Tray(icon)
    } catch {
      // Linux without tray support — tray creation throws or produces non-functional tray
      console.warn('[TrayManager] tray creation failed — tray not available on this system')
      this.trayAvailable = false
      this.tray = null
      return
    }

    this.tray.setToolTip('AttaSeek')

    // Pre-load session cache
    await this.refreshSessionCache()

    // Build initial menu
    this.rebuildMenu()

    // Platform-specific click handling
    if (isMac) {
      // macOS menu bar: left click = show menu
      this.tray.on('click', () => {
        // menu-will-show is macOS-specific; rebuild on every show to keep sessions fresh
        this.rebuildMenu()
      })
      this.tray.on('right-click', () => {
        this.rebuildMenu()
      })
      this.tray.on('mouse-move', () => {
        // Debounce: refresh cache at most once per 2 seconds on mouse hover
        if (this.sessionCacheDebounceTimer) return
        this.sessionCacheDebounceTimer = setTimeout(() => {
          this.sessionCacheDebounceTimer = null
          void this.refreshSessionCache()
        }, 2000)
      })
    } else {
      // Windows/Linux: left click = toggle windows, right click = context menu
      this.tray.on('click', () => {
        this.toggleWindows()
      })
      this.tray.on('right-click', () => {
        this.rebuildMenu()
      })
    }

    // Double-click always restores windows on all platforms
    this.tray.on('double-click', () => {
      this.showAllWindows()
    })

    // Detect Linux tray degradation: if tray icon doesn't respond after 500ms
    if (process.platform === 'linux') {
      setTimeout(() => {
        this.detectLinuxTray()
      }, 500)
    }
  }

  /** Destroy the tray icon (called on app quit). */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }

  /** Whether the system tray is functional. */
  isTrayAvailable(): boolean {
    return this.trayAvailable && this.tray !== null && !this.tray.isDestroyed()
  }

  /** Whether close-to-tray behavior should apply. */
  async isMinimizeToTrayEnabled(): Promise<boolean> {
    return this.isTrayAvailable() && (await TraySettings.isMinimizeToTrayEnabled())
  }

  /** Handle a window close event. Returns true if the close was intercepted (minimized). */
  handleClose(win: BrowserWindow): boolean {
    const visibleWindows = BrowserWindow.getAllWindows().filter(w => w.isVisible())
    // Only intercept close of the last visible window
    if (visibleWindows.length <= 1 && visibleWindows[0]?.id === win.id) {
      // Check if we should minimize to tray (read cached setting synchronously to
      // avoid async in close handler; settings are read at startup and cached)
      if (this.trayAvailable && this.tray) {
        win.hide()
        this.hiddenWindows.add(win.id)
        this.showFirstMinimizeNotification()
        return true // intercepted
      }
    }
    return false // allow close
  }

  /** Show all previously hidden windows. */
  showAllWindows(): void {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length === 0) {
      // No windows exist — need to create one (handled by caller or activate event)
      return
    }
    for (const win of allWindows) {
      if (!win.isDestroyed()) {
        win.show()
        win.focus()
      }
    }
    this.hiddenWindows.clear()
  }

  /** Hide all visible windows to tray. */
  hideAllWindows(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && win.isVisible()) {
        this.hiddenWindows.add(win.id)
        win.hide()
      }
    }
  }

  /** Toggle all windows show/hide. */
  toggleWindows(): void {
    const anyVisible = BrowserWindow.getAllWindows().some(w => w.isVisible())
    if (anyVisible) {
      this.hideAllWindows()
    } else {
      this.showAllWindows()
    }
  }

  /** Handle quit request from tray menu. */
  async handleQuit(): Promise<void> {
    const activeCount = agentRuntime.countActiveTasks()
    if (activeCount > 0) {
      setLocale(loadLocale())
      const result = await dialog.showMessageBox({
        type: 'warning',
        title: t('tray.appTitle'),
        message: t('tray.quitWithTasks', { count: activeCount }),
        buttons: [t('tray.quit'), t('tray.cancel')],
        defaultId: 1,
        cancelId: 1,
      })
      if (result.response !== 0) return
    }
    app.quit()
  }

  /** Rebuild the context menu with fresh session data. */
  rebuildMenu(): void {
    if (!this.tray || this.tray.isDestroyed()) return

    // Sync locale before building menu
    setLocale(loadLocale())

    const menu = new Menu()

    // Show/Hide window
    const anyVisible = BrowserWindow.getAllWindows().some(w => w.isVisible())
    menu.append(new MenuItem({
      label: anyVisible ? t('tray.hideWindow') : t('tray.showWindow'),
      click: () => this.toggleWindows(),
    }))

    // New chat
    menu.append(new MenuItem({
      label: isMac ? t('tray.newChat.mac') : t('tray.newChat.other'),
      click: () => {
        this.showAllWindows()
        this.sendNavigate('')
      },
    }))

    // Conversations submenu
    const sessions = this.cachedSessions
    if (sessions.length > 0) {
      const convMenu = new Menu()
      for (const s of sessions.slice(0, 5)) {
        const title = s.title.length > 40 ? s.title.slice(0, 37) + '...' : s.title
        convMenu.append(new MenuItem({
          label: title,
          click: () => {
            this.showAllWindows()
            this.sendNavigate(s.id)
          },
        }))
      }
      menu.append(new MenuItem({ label: t('tray.conversations'), submenu: convMenu }))
    } else {
      const emptyMenu = new Menu()
      emptyMenu.append(new MenuItem({ label: t('tray.noConversations'), enabled: false }))
      menu.append(new MenuItem({ label: t('tray.conversations'), submenu: emptyMenu }))
    }

    menu.append(new MenuItem({ type: 'separator' }))

    // Quit
    menu.append(new MenuItem({
      label: isMac ? t('tray.quit.mac') : t('tray.quit.other'),
      click: () => { void this.handleQuit() },
    }))

    this.tray.setContextMenu(menu)
  }

  /** Refresh the cached session list for menu display. */
  async refreshSessionCache(): Promise<void> {
    try {
      const sessions = await listSessions()
      this.cachedSessions = sessions.slice(0, 5).map(s => ({ id: s.id, title: s.title }))
    } catch (err) {
      console.warn('[TrayManager] failed to refresh session cache:', err)
    }
  }

  // ── Private ──

  private sendNavigate(sessionId: string): void {
    // Push event to all renderer windows
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('tray:navigate', { sessionId })
      }
    }
  }

  private showFirstMinimizeNotification(): void {
    // Prevent duplicate notifications from rapid minimize/restore cycles
    if (this.minimizeNotifiedFlag) return
    this.minimizeNotifiedFlag = true

    void TraySettings.get().then(settings => {
      if (settings.firstMinimizeNotified) return
      try {
        const n = new Notification({
          title: t('tray.appTitle'),
          body: t('tray.runningInBackground'),
        })
        n.show()
        void TraySettings.update({ firstMinimizeNotified: true })
      } catch (err) {
        console.warn('[TrayManager] notification failed:', err)
        this.minimizeNotifiedFlag = false // allow retry next time
      }
    }).catch(err => {
      console.warn('[TrayManager] settings read failed for notification:', err)
      this.minimizeNotifiedFlag = false
    })
  }

  private detectLinuxTray(): void {
    // Heuristic: if Linux tray doesn't respond, mark unavailable.
    // We check whether the tray object still exists and isn't destroyed.
    // On some Linux DEs without tray support, Electron creates a Tray but it
    // doesn't display or respond. We use a short timeout as heuristic.
    if (!this.tray || this.tray.isDestroyed()) {
      this.trayAvailable = false
      console.warn('[TrayManager] Linux tray not responding — tray disabled')
    }
    // Otherwise assume it's working (KDE, XFCE, GNOME+extension, etc.)
  }
}

/** Singleton instance */
export const trayManager = new TrayManager()
