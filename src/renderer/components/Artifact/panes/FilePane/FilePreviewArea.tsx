/**
 * FilePreviewArea — multi-tab file preview with Monaco Editor for code,
 * and specialized renderers for Markdown, images, and PDF.
 */

import { useState, useEffect, useCallback } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { X } from 'lucide-react'
import { languageFromPath } from '../../../../utils/languageMap'
import { getApi } from '../../../../utils/api'

interface FileTab {
  id: string
  path: string
  name: string
  mime?: string
}

interface FilePreviewAreaProps {
  tabs: FileTab[]
  activeTabId: string | null
  onTabClick: (id: string) => void
  onTabClose: (id: string) => void
}

function isImage(mime?: string): boolean {
  return !!mime && mime.startsWith('image/') && !mime.includes('svg')
}

function isPdf(mime?: string): boolean {
  return mime === 'application/pdf'
}

function isBinary(mime?: string): boolean {
  if (!mime) return false
  const textTypes = ['text/', 'application/json', 'application/xml', 'application/javascript']
  if (textTypes.some((t) => mime.startsWith(t))) return false
  if (mime.startsWith('image/') || mime === 'application/pdf') return false
  return true
}

export default function FilePreviewArea({ tabs, activeTabId, onTabClick, onTabClose }: FilePreviewAreaProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markdownView, setMarkdownView] = useState<'source' | 'preview'>('preview')

  // Load file content when active tab changes (keyed by tab id, not just path)
  useEffect(() => {
    if (!activeTab) return
    if (isImage(activeTab.mime) || isPdf(activeTab.mime) || isBinary(activeTab.mime)) {
      setContent(''); setError(null); return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    const api = getApi()

    api?.fs.readFile(activeTab.path).then((result) => {
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
  }, [activeTab?.id, activeTab?.path])

  const handleEditorMount = useCallback((_editor: unknown, monaco: Monaco) => {
    // Set VS Code Dark theme
    monaco.editor.setTheme('vs-dark')
  }, [])

  // Render file content
  const renderContent = () => {
    if (!activeTab) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-[var(--app-text-tertiary)]">
          Select a file to preview
        </div>
      )
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-[var(--app-text-tertiary)]">
          Loading...
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-[var(--app-error)] p-4 text-center">
          {error}
        </div>
      )
    }

    // Image preview
    if (isImage(activeTab.mime)) {
      return (
        <div className="flex items-center justify-center h-full bg-[#1e1e1e] p-4">
          <img
            src={`file://${activeTab.path}`}
            alt={activeTab.name}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )
    }

    // PDF preview
    if (isPdf(activeTab.mime)) {
      return (
        <div className="h-full">
          <embed src={`file://${activeTab.path}`} type="application/pdf" className="w-full h-full" />
        </div>
      )
    }

    // Binary file
    if (isBinary(activeTab.mime)) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-[var(--app-text-tertiary)]">
          Binary file — preview not supported
        </div>
      )
    }

    // Markdown: preview + source toggle with Monaco
    if (activeTab.path.endsWith('.md')) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-2 px-3 py-1 border-b border-[var(--app-border)] bg-[var(--app-bg)]">
            <button
              onClick={() => setMarkdownView('preview')}
              className={`text-xs px-2 py-0.5 rounded ${markdownView === 'preview' ? 'bg-[var(--app-accent)]/20 text-[var(--app-accent)]' : 'text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)]'}`}
            >Preview</button>
            <button
              onClick={() => setMarkdownView('source')}
              className={`text-xs px-2 py-0.5 rounded ${markdownView === 'source' ? 'bg-[var(--app-accent)]/20 text-[var(--app-accent)]' : 'text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)]'}`}
            >Source</button>
          </div>
          {markdownView === 'source' ? (
            <div className="flex-1">
              <Editor
                value={content}
                language="markdown"
                theme="vs-dark"
                options={{ readOnly: true, minimap: { enabled: false }, lineNumbers: 'on', fontSize: 13 }}
                onMount={handleEditorMount}
                loading={<div className="text-xs text-[var(--app-text-tertiary)] p-4">Loading editor...</div>}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4 prose prose-sm prose-invert max-w-none">
              <pre className="text-sm font-mono text-[var(--app-text-primary)] whitespace-pre-wrap">
                <code>{content}</code>
              </pre>
            </div>
          )}
        </div>
      )
    }

    // Default: Monaco Editor with syntax highlighting
    const lang = languageFromPath(activeTab.path)
    return (
      <div className="flex-1">
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

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Internal tab bar */}
      {tabs.length > 0 && (
        <div className="flex items-center h-[28px] border-b border-[var(--app-border)] flex-shrink-0 bg-[var(--app-bg-secondary)]">
          <div className="flex items-center gap-0 overflow-hidden flex-1 min-w-0">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => onTabClick(tab.id)}
                className={`group flex items-center gap-1 px-2.5 py-0.5 text-xs cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors ${
                  tab.id === activeTabId
                    ? 'bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] border-t border-[var(--app-accent)]'
                    : 'text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]'
                }`}
              >
                <span>{tab.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
                  className="rounded-sm opacity-0 group-hover:opacity-100 hover:bg-[var(--app-bg-hover)] transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  )
}
