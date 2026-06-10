/**
 * BrowserPane — embedded web browser via <iframe>.
 *
 * Uses a plain iframe instead of Electron's <webview> tag because
 * <webview> is deprecated and unreliable in Electron 33+. Iframes
 * work everywhere with no special configuration.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { PaneProps } from '../../PaneRegistry'
import BrowserNavBar from './BrowserNavBar'
import BrowserMenu from './BrowserMenu'
import DeviceToolbar from './DeviceToolbar'

export default function BrowserPane(_props: PaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [displayUrl, setDisplayUrl] = useState('')
  const [deviceToolbarVisible, setDeviceToolbarVisible] = useState(false)
  const [zoom, setZoom] = useState(100)

  // Update iframe zoom when zoom state changes
  useEffect(() => {
    const el = iframeRef.current
    if (el) el.style.zoom = String(zoom / 100)
  }, [zoom])

  // Navigation
  const navigateTo = useCallback((raw: string) => {
    const href = raw.trim()
    if (!href || href === 'about:blank') return
    const url = /^https?:\/\//i.test(href) || href.startsWith('about:') ? href : 'https://' + href
    setDisplayUrl(url)
    const el = iframeRef.current
    if (el) el.src = url
  }, [])

  const goBack    = useCallback(() => { iframeRef.current?.contentWindow?.history.back() }, [])
  const goForward = useCallback(() => { iframeRef.current?.contentWindow?.history.forward() }, [])
  const refresh   = useCallback(() => { iframeRef.current?.contentWindow?.location.reload() }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <BrowserNavBar
        url={displayUrl}
        canGoBack={false}
        canGoForward={false}
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
        <DeviceToolbar onDeviceChange={() => {}} />
      )}

      <div className="flex-1 relative bg-white">
        <iframe
          ref={iframeRef}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    </div>
  )
}
