/**
 * useTerminal — lifecycle hook for xterm.js + node-pty integration.
 *
 * 1. Mount → IPC terminal:create → get terminalId
 * 2. Create xterm.Terminal instance, attach to DOM ref
 * 3. xterm onData → IPC terminal:write
 * 4. IPC terminal:output → xterm.write
 * 5. Resize observer → IPC terminal:resize
 * 6. Unmount → IPC terminal:destroy → xterm dispose
 */

import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { getApi } from '../../../../utils/api'

interface UseTerminalOptions {
  cwd: string
}

interface UseTerminalResult {
  terminalId: string | null
  containerRef: React.RefObject<HTMLDivElement>
}

export function useTerminal({ cwd }: UseTerminalOptions): UseTerminalResult {
  const containerRef = useRef<HTMLDivElement>(null!)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const terminalIdRef = useRef<string | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    const api = getApi()

    if (!api?.terminal) {
      container.innerHTML = '<div class="text-xs text-gray-400 p-4">Terminal API not available in this environment</div>'
      return
    }

    // Create xterm instance
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
        black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
        blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
        brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b',
        brightYellow: '#f5f543', brightBlue: '#3b8eea', brightMagenta: '#d670d6',
        brightCyan: '#29b8db', brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    terminalRef.current = term
    fitAddonRef.current = fitAddon

    // Try WebGL renderer for better performance
    try {
      term.loadAddon(new WebglAddon())
    } catch {
      // Fall back to canvas renderer
    }

    // Attach to DOM
    term.open(container)

    // Create PTY
    api.terminal.create(cwd, term.cols, term.rows).then((result) => {
      if (disposed) return
      if (!result.success || !result.terminalId) {
        term.write('\r\n\x1b[31mFailed to create terminal: ' + (result.error || 'unknown error') + '\x1b[0m\r\n')
        return
      }
      terminalIdRef.current = result.terminalId

      // Wire data flow
      term.onData((data: string) => {
        const tid = terminalIdRef.current
        if (tid) api.terminal.write(tid, data)
      })

      unsubRef.current = api.terminal.onOutput(({ terminalId, data }) => {
        if (terminalId === terminalIdRef.current && !disposed) {
          term.write(data)
        }
      })

      // Fit after PTY is ready
      setTimeout(() => {
        try { fitAddon.fit() } catch { /* ignore */ }
      }, 100)
    }).catch((err: Error) => {
      if (!disposed) {
        term.write(`\r\n\x1b[31mTerminal error: ${err.message}\x1b[0m\r\n`)
      }
    })

    // Resize observer with RAF debounce
    let resizeRafId: number | null = null
    const resizeObserver = new ResizeObserver(() => {
      if (disposed) return
      if (resizeRafId !== null) return // Skip if a resize is already queued
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null
        if (disposed) return
        try {
          fitAddon.fit()
          const tid = terminalIdRef.current
          if (tid) api.terminal.resize(tid, term.cols, term.rows)
        } catch { /* ignore resize errors */ }
      })
    })
    resizeObserver.observe(container)

    return () => {
      disposed = true
      resizeObserver.disconnect()
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId)
      // Call the stored unsub from PTY setup
      unsubRef.current?.()
      unsubRef.current = null
      const tid = terminalIdRef.current
      if (tid) api.terminal.destroy(tid).catch(() => {})
      terminalIdRef.current = null
      try { term.dispose() } catch { /* ignore */ }
      terminalRef.current = null
    }
  }, [cwd])

  return { terminalId: terminalIdRef.current, containerRef }
}
