/**
 * WindowState — persist and restore window position, size, and maximized state.
 *
 * Saved to app_state.json under the key "windowState" on window close/move/resize.
 * Restored on the next window creation. Uses JSONStore for consistent async I/O.
 */

import { BrowserWindow } from 'electron'
import { JSONStore } from './store/FileStore'
import { dataDir } from './store/paths'
import { debounce } from './utils/timing'

interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
  isFullScreen: boolean
}

const store = new JSONStore<Record<string, string>>(`${dataDir()}/app_state.json`)

const DEFAULT_BOUNDS: WindowBounds = {
  width: 1400,
  height: 900,
  isMaximized: false,
  isFullScreen: false,
}

async function loadBounds(): Promise<WindowBounds> {
  try {
    const data = await store.read()
    const state = data['windowState']
    if (typeof state === 'string') {
      const parsed = JSON.parse(state) as Partial<WindowBounds>
      return { ...DEFAULT_BOUNDS, ...parsed }
    }
    if (typeof state === 'object' && state !== null) {
      return { ...DEFAULT_BOUNDS, ...(state as Partial<WindowBounds>) }
    }
    return DEFAULT_BOUNDS
  } catch {
    return DEFAULT_BOUNDS
  }
}

function saveBounds(bounds: WindowBounds): void {
  void store.read().then(data => {
    data['windowState'] = JSON.stringify(bounds)
    void store.write(data)
  })
}

export const WindowState = {
  /** Apply saved bounds to a window (call before show). */
  async restore(win: BrowserWindow): Promise<void> {
    const bounds = await loadBounds()
    if (bounds.x !== undefined && bounds.y !== undefined) {
      win.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height })
    } else {
      win.setSize(bounds.width, bounds.height)
      win.center()
    }
    if (bounds.isMaximized) win.maximize()
    if (bounds.isFullScreen) win.setFullScreen(true)
  },

  /** Start tracking a window for state changes. */
  track(win: BrowserWindow): void {
    const persist = (): void => {
      try {
        const isMaximized = win.isMaximized()
        const isFullScreen = win.isFullScreen()
        // Only save normal bounds if not maximized/fullscreen
        if (!isMaximized && !isFullScreen) {
          const bounds = win.getBounds()
          saveBounds({ ...bounds, isMaximized: false, isFullScreen: false })
        } else {
          saveBounds({ x: undefined, y: undefined, width: 1400, height: 900, isMaximized, isFullScreen })
        }
      } catch { /* window may be destroyed */ }
    }

    win.on('resize', debounce(persist, 500))
    win.on('move', debounce(persist, 500))
    win.on('maximize', persist)
    win.on('unmaximize', persist)
    win.on('enter-full-screen', persist)
    win.on('leave-full-screen', persist)
    win.on('close', persist)
  },
}
