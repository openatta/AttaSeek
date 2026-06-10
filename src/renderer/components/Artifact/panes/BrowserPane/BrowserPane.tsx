/**
 * BrowserPane — embedded web browser via Electron <webview> tag.
 *
 * The webview is rendered via JSX (not imperative createElement) so
 * Electron's native custom-element registration initialises it properly.
 * Navigation is controlled imperatively via ref — no reactive src binding
 * that could interfere with Electron's internal browser process lifecycle.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { PaneProps } from '../../PaneRegistry'
import BrowserNavBar from './BrowserNavBar'
import BrowserMenu from './BrowserMenu'
import DeviceToolbar from './DeviceToolbar'

export default function BrowserPane(_props: PaneProps) {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)

  const [displayUrl, setDisplayUrl] = useState('')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [deviceToolbarVisible, setDeviceToolbarVisible] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [title, setTitle] = useState('')

  // Attach listeners to the webview once it mounts
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onFinishLoad = () => {
      setCanGoBack(wv.canGoBack())
      setCanGoForward(wv.canGoForward())
      setDisplayUrl(wv.getURL())
      console.log('[BrowserPane] webview loaded:', wv.getURL())
    }

    const onFailLoad = (e: Event) => {
      const d = e as CustomEvent<{ errorCode: number; errorDescription: string; validatedURL: string }>
      console.error('[BrowserPane] load failed:', d.detail)
    }

    const onTitleUpdated = (e: Event) => {
      setTitle((e as CustomEvent).detail || '')
    }

    wv.addEventListener('did-finish-load', onFinishLoad)
    wv.addEventListener('did-fail-load', onFailLoad)
    wv.addEventListener('page-title-updated', onTitleUpdated)

    // Log that the webview is ready
    console.log('[BrowserPane] webview attached, src:', wv.src || wv.getAttribute('src'))

    return () => {
      wv.removeEventListener('did-finish-load', onFinishLoad)
      wv.removeEventListener('did-fail-load', onFailLoad)
      wv.removeEventListener('page-title-updated', onTitleUpdated)
    }
  }, [])

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
    if (!wv) {
      console.warn('[BrowserPane] webviewRef is null')
      return
    }

    // Try all available navigation methods. In some Electron/Chromium
    // combinations, setting the src attribute is more reliable than
    // loadURL(), and vice versa.
    console.log('[BrowserPane] navigating to:', final)
    wv.setAttribute('src', final)
    try {
      wv.loadURL(final).catch((err: Error) => {
        console.error('[BrowserPane] loadURL rejected:', err.message)
      })
    } catch (err) {
      console.error('[BrowserPane] loadURL threw:', err)
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

  // Sync zoom to webview style
  useEffect(() => {
    const wv = webviewRef.current
    if (wv) {
      wv.style.zoom = String(zoom / 100)
    }
  }, [zoom])

  const handleDeviceChange = useCallback((device: { userAgent: string }) => {
    const wv = webviewRef.current
    if (wv && device.userAgent) {
      wv.setUserAgent(device.userAgent)
    }
  }, [])

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

      <div className="flex-1 relative bg-white">
        {/* JSX webview — Electron natively registers and initialises the custom element.
            No reactive src: navigation is done imperatively via ref.
            Use a data: URL for the initial load so the webview has a real document
            context; about:blank can prevent navigation in some Electron versions. */}
        <webview
          ref={webviewRef}
          src="data:text/html,<html><body style='background:#fff'></body></html>"
          nodeintegration="false"
          webpreferences="sandbox=yes"
          style={{ width: '100%', height: '100%', display: 'flex' } as React.CSSProperties}
        />
        {displayUrl && (
          <div className="absolute top-0 left-0 right-0 px-2 py-0.5 text-[10px] text-gray-400 bg-white/80 truncate pointer-events-none">
            {displayUrl}
          </div>
        )}
      </div>
    </div>
  )
}
