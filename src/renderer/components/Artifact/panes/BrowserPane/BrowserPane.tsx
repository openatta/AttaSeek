/**
 * BrowserPane — embedded web browser via Electron <webview> element.
 *
 * The webview is created imperatively (not via JSX) because React's
 * reconciliation can interfere with Electron's custom element lifecycle:
 * StrictMode double-mount, reactive src binding, and attribute re-setting
 * can all prevent the webview from initializing its internal browser process.
 *
 * Single-instance constraint enforced at AP Tab level (PaneRegistry).
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { PaneProps } from '../../PaneRegistry'
import BrowserNavBar from './BrowserNavBar'
import BrowserMenu from './BrowserMenu'
import DeviceToolbar from './DeviceToolbar'

export default function BrowserPane(_props: PaneProps) {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [displayUrl, setDisplayUrl] = useState('')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [deviceToolbarVisible, setDeviceToolbarVisible] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [title, setTitle] = useState('')

  // ── Imperative webview creation ──────────────────────────────
  // Avoids React JSX reconciliation which can break Electron's
  // custom element initialization (especially in StrictMode).

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const wv = document.createElement('webview') as unknown as Electron.WebviewTag
    wv.setAttribute('src', 'about:blank')
    wv.setAttribute('nodeintegration', 'false')
    wv.setAttribute('webpreferences', 'sandbox=yes')
    wv.style.width = '100%'
    wv.style.height = '100%'

    const onFinishLoad = () => {
      setCanGoBack(wv.canGoBack())
      setCanGoForward(wv.canGoForward())
      setDisplayUrl(wv.getURL())
    }

    const onTitleUpdated = (e: Event) => {
      setTitle((e as CustomEvent).detail || '')
    }

    const onFailLoad = (e: Event) => {
      const detail = e as CustomEvent<{ errorCode: number; errorDescription: string; validatedURL: string }>
      console.error('[BrowserPane] Navigation failed:', detail.detail)
    }

    wv.addEventListener('did-finish-load', onFinishLoad)
    wv.addEventListener('did-fail-load', onFailLoad)
    wv.addEventListener('page-title-updated', onTitleUpdated)

    container.appendChild(wv)
    webviewRef.current = wv

    return () => {
      wv.removeEventListener('did-finish-load', onFinishLoad)
      wv.removeEventListener('did-fail-load', onFailLoad)
      wv.removeEventListener('page-title-updated', onTitleUpdated)
      try { wv.remove() } catch { /* already removed */ }
      webviewRef.current = null
    }
  }, [])

  // ── Navigation ───────────────────────────────────────────────

  const updateNavState = useCallback(() => {
    const wv = webviewRef.current
    if (wv) {
      setCanGoBack(wv.canGoBack())
      setCanGoForward(wv.canGoForward())
    }
  }, [])

  const navigateTo = useCallback((targetUrl: string) => {
    const href = targetUrl.trim()
    if (!href || href === 'about:blank') return
    const final = /^https?:\/\//i.test(href) || href.startsWith('about:') ? href : 'https://' + href
    setDisplayUrl(final)

    const wv = webviewRef.current
    if (wv) {
      wv.src = final
    } else {
      console.warn('[BrowserPane] webviewRef is null, cannot navigate')
    }
  }, [])

  const goBack = useCallback(() => {
    webviewRef.current?.goBack()
    setTimeout(updateNavState, 100)
  }, [updateNavState])

  const goForward = useCallback(() => {
    webviewRef.current?.goForward()
    setTimeout(updateNavState, 100)
  }, [updateNavState])

  const refresh = useCallback(() => {
    webviewRef.current?.reload()
  }, [])

  // ── Zoom ─────────────────────────────────────────────────────

  useEffect(() => {
    const wv = webviewRef.current
    if (wv) {
      wv.style.zoom = String(zoom / 100)
    }
  }, [zoom])

  // ── Device toolbar ───────────────────────────────────────────

  const handleDeviceChange = useCallback((device: { userAgent: string }) => {
    const wv = webviewRef.current
    if (wv && device.userAgent) {
      wv.setUserAgent(device.userAgent)
    }
  }, [])

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <BrowserNavBar
        url={displayUrl}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onUrlChange={setDisplayUrl}
        onNavigate={navigateTo}
        onBack={goBack}
        onForward={goForward}
        onRefresh={refresh}
        menu={
          <BrowserMenu
            onForceReload={refresh}
            onToggleDeviceToolbar={() => setDeviceToolbarVisible(!deviceToolbarVisible)}
            deviceToolbarVisible={deviceToolbarVisible}
            zoom={zoom}
            onZoomChange={setZoom}
            onClearCookies={() => refresh()}
            onClearCache={() => refresh()}
          />
        }
      />

      {deviceToolbarVisible && (
        <DeviceToolbar onDeviceChange={handleDeviceChange} />
      )}

      <div ref={containerRef} className="flex-1 relative bg-white" />
    </div>
  )
}
