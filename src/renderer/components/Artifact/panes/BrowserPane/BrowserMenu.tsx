/**
 * BrowserMenu — ⋮ dropdown with 7 items:
 * Force reload, Toggle device toolbar, ──, Zoom, ──, Clear cookies, Clear cache
 */

import { useState } from 'react'

interface BrowserMenuProps {
  onForceReload: () => void
  onToggleDeviceToolbar: () => void
  deviceToolbarVisible: boolean
  zoom: number
  onZoomChange: (z: number) => void
  onClearCookies: () => void
  onClearCache: () => void
}

export default function BrowserMenu({
  onForceReload, onToggleDeviceToolbar, deviceToolbarVisible,
  zoom, onZoomChange, onClearCookies, onClearCache,
}: BrowserMenuProps) {
  const [open, setOpen] = useState(false)
  const [zoomInput, setZoomInput] = useState(String(zoom))

  const applyZoom = () => {
    const n = parseInt(zoomInput, 10)
    if (!isNaN(n) && n >= 25 && n <= 500) onZoomChange(n)
    else setZoomInput(String(zoom))
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors"
        title="Menu"
      >
        <span className="text-sm leading-none tracking-widest">⋮</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg z-50 py-1">
            <button
              onClick={() => { onForceReload(); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
            >
              强制重新加载
            </button>
            <button
              onClick={() => { onToggleDeviceToolbar(); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors flex items-center justify-between"
            >
              <span>显示设备工具栏</span>
              {deviceToolbarVisible && <span className="text-[10px] text-[var(--app-accent)]">✓</span>}
            </button>

            <div className="border-t border-[var(--app-border)] my-1" />

            <div className="px-3 py-1.5 flex items-center gap-2">
              <span className="text-xs text-[var(--app-text-secondary)]">缩放</span>
              <input
                type="text"
                value={zoomInput}
                onChange={(e) => setZoomInput(e.target.value)}
                onBlur={applyZoom}
                onKeyDown={(e) => { if (e.key === 'Enter') applyZoom() }}
                className="w-16 px-1.5 py-0.5 text-xs bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
              />
              <span className="text-xs text-[var(--app-text-tertiary)]">%</span>
            </div>

            <div className="border-t border-[var(--app-border)] my-1" />

            <button
              onClick={() => { onClearCookies(); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
            >
              清除 Cookie
            </button>
            <button
              onClick={() => { onClearCache(); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
            >
              清除缓存
            </button>
          </div>
        </>
      )}
    </div>
  )
}
