/**
 * BrowserPane — embedded web browser via Electron <webview> JSX element.
 * Single-instance constraint enforced at AP Tab level (PaneRegistry).
 *
 * Uses the webview type declarations from src/types/electron.d.ts.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { PaneProps } from '../../PaneRegistry'
import BrowserNavBar from './BrowserNavBar'
import BrowserMenu from './BrowserMenu'
import DeviceToolbar from './DeviceToolbar'

const DEFAULT_URL = 'about:blank'

export default function BrowserPane(_props: PaneProps) {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const [url, setUrl] = useState(DEFAULT_URL)
  const [displayUrl, setDisplayUrl] = useState('')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [deviceToolbarVisible, setDeviceToolbarVisible] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [title, setTitle] = useState('')

  // Attach event listeners to the webview
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onFinishLoad = () => {
      setCanGoBack(wv.canGoBack())
      setCanGoForward(wv.canGoForward())
      setDisplayUrl(wv.getURL())
      setTitle(document.title)
    }

    const onStartLoading = () => {
      // Could show loading indicator
    }

    const onTitleUpdated = (e: Event) => {
      setTitle((e as CustomEvent).detail || '')
    }

    wv.addEventListener('did-finish-load', onFinishLoad)
    wv.addEventListener('did-start-loading', onStartLoading)
    wv.addEventListener('page-title-updated', onTitleUpdated)

    return () => {
      wv.removeEventListener('did-finish-load', onFinishLoad)
      wv.removeEventListener('did-start-loading', onStartLoading)
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
    console.log('[BrowserPane] navigateTo called:', { targetUrl, href, webviewRef: !!webviewRef.current })
    if (!href || href === 'about:blank') return
    const final = /^https?:\/\//i.test(href) || href.startsWith('about:') ? href : 'https://' + href
    console.log('[BrowserPane] navigating to:', final)
    setUrl(final)
    setDisplayUrl(final)
    webviewRef.current?.loadURL(final)
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

  return (
    <div className="flex flex-col h-full">
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
        <DeviceToolbar
          onDeviceChange={(device) => {
            const wv = webviewRef.current
            if (wv && device.userAgent) {
              wv.setUserAgent(device.userAgent)
            }
          }}
        />
      )}

      <div className="flex-1 relative bg-white">
        <webview
          ref={webviewRef}
          src={url}
          className="w-full h-full"
          {...({ nodeintegration: 'false', webpreferences: 'sandbox=yes' } as Record<string, string>)}
          style={{ zoom: String(zoom / 100) }}
        />
        {title && (
          <div className="absolute top-0 left-0 right-0 px-2 py-0.5 text-[10px] text-gray-400 bg-white/80 truncate pointer-events-none">
            {title}
          </div>
        )}
      </div>
    </div>
  )
}
