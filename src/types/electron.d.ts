/**
 * Type declarations for Electron-specific DOM elements.
 */

declare namespace JSX {
  interface IntrinsicElements {
    /** Electron <webview> tag — embedded web browser */
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string
        nodeintegration?: string
        webpreferences?: string
        partition?: string
        allowpopups?: string
        preload?: string
        ref?: React.Ref<Electron.WebviewTag>
      },
      HTMLElement
    >
  }
}

declare namespace Electron {
  interface WebviewTag extends HTMLElement {
    src: string
    canGoBack(): boolean
    canGoForward(): boolean
    goBack(): void
    goForward(): void
    reload(): void
    stop(): void
    loadURL(url: string): Promise<void>
    getURL(): string
    getUserAgent(): string
    setUserAgent(userAgent: string): void
    openDevTools(): void
    closeDevTools(): void
    isDevToolsOpened(): boolean
    addEventListener(
      type: 'did-finish-load' | 'did-start-loading' | 'did-stop-loading' | 'did-navigate' | 'page-title-updated',
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ): void
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ): void
  }
}
