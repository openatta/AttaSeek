/**
 * FilePreviewArea — unified file viewer.
 *
 * Routes to the appropriate renderer based on MIME type:
 * - Image: inline <img> with file:// protocol
 * - PDF: <embed> with Chrome built-in viewer
 * - Binary (non-text): HexViewer
 * - Text/Code: Monaco Editor with syntax highlighting
 *
 * No preview/source toggle — all files open directly in their native view.
 * No internal tab bar — file tabs are now AP-level (ApTabBar).
 */

import { useState, useEffect, useCallback } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { languageFromPath } from '../../../../utils/languageMap'
import { getApi } from '../../../../utils/api'
import HexViewer from './HexViewer'

interface Props {
  filePath: string
  mime?: string
}

function isImage(mime?: string): boolean {
  // SVG rendered via <img> for XSS safety (inline SVG can contain <script>)
  return !!mime && mime.startsWith('image/')
}

function isPdf(mime?: string): boolean {
  return mime === 'application/pdf'
}

function isTextLike(mime?: string): boolean {
  if (!mime) return true // assume text by default
  const textPrefixes = ['text/', 'application/json', 'application/xml', 'application/javascript', 'application/x-']
  return textPrefixes.some((p) => mime.startsWith(p))
}

export default function FilePreviewArea({ filePath, mime }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!filePath) return

    // Non-text files — don't load content as string
    if (isImage(mime) || isPdf(mime) || !isTextLike(mime)) {
      setContent(''); setError(null); return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    const api = getApi()

    api?.fs.readFile(filePath).then((result) => {
      if (cancelled) return
      if (result.success && result.content !== undefined) {
        setContent(result.content)
        setError(null)
      } else {
        setContent('')
        setError(result.error || 'Failed to load file')
      }
    }).catch((err: Error) => {
      if (cancelled) return
      setContent('')
      setError(err.message)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [filePath, mime])

  const handleEditorMount = useCallback((_editor: unknown, monaco: Monaco) => {
    monaco.editor.setTheme('vs-dark')
  }, [])

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--app-text-tertiary)]">
        Loading...
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--app-error)] p-4 text-center">
        {error}
      </div>
    )
  }

  // ── Image ──
  if (isImage(mime)) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e] p-4">
        <img
          src={`file://${filePath}`}
          alt={filePath.split('/').pop()}
          className="max-w-full max-h-full object-contain"
        />
      </div>
    )
  }

  // ── PDF ──
  if (isPdf(mime)) {
    return (
      <div className="h-full">
        <embed src={`file://${filePath}`} type="application/pdf" className="w-full h-full" />
      </div>
    )
  }

  // ── Binary / non-text ──
  if (!isTextLike(mime)) {
    return <HexViewer filePath={filePath} />
  }

  // ── Default: Monaco Editor with syntax highlighting ──
  const lang = languageFromPath(filePath)
  return (
    <div className="h-full">
      <Editor
        value={content}
        language={lang}
        theme="vs-dark"
        options={{ readOnly: true, minimap: { enabled: false }, lineNumbers: 'on', fontSize: 13 }}
        onMount={handleEditorMount}
        loading={<div className="text-xs text-[var(--app-text-tertiary)] p-4">Loading editor...</div>}
      />
    </div>
  )
}
