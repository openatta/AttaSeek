/**
 * DiffView — Monaco DiffEditor wrapper for side-by-side/inline git diff.
 *
 * Uses @monaco-editor/react DiffEditor component. Falls back to a simple
 * unified diff renderer if Monaco fails to load.
 */

import { DiffEditor, type Monaco } from '@monaco-editor/react'
import { languageFromPath } from '../../../../utils/languageMap'

interface DiffViewProps {
  original: string
  modified: string
  language: string
  mode: 'side-by-side' | 'inline'
}

/** Simple fallback when Monaco fails to load */
function FallbackDiff({ original, modified, mode }: DiffViewProps) {
  if (mode === 'side-by-side') {
    return (
      <div className="flex h-full">
        <div className="flex-1 border-r border-[var(--app-border)] overflow-auto">
          <div className="sticky top-0 px-2 py-0.5 bg-[var(--app-bg)] border-b border-[var(--app-border)] text-[10px] text-[var(--app-text-tertiary)] uppercase">Original</div>
          <pre className="p-2 text-xs font-mono text-[var(--app-text-primary)] whitespace-pre-wrap">{original.slice(0, 50000)}</pre>
        </div>
        <div className="flex-1 overflow-auto">
          <div className="sticky top-0 px-2 py-0.5 bg-[var(--app-bg)] border-b border-[var(--app-border)] text-[10px] text-[var(--app-text-tertiary)] uppercase">Modified</div>
          <pre className="p-2 text-xs font-mono text-[var(--app-text-primary)] whitespace-pre-wrap">{modified.slice(0, 50000)}</pre>
        </div>
      </div>
    )
  }

  // Inline fallback: simple line-by-line
  const origLines = original.split('\n')
  const modLines = modified.split('\n')
  const maxLen = Math.max(origLines.length, modLines.length)
  return (
    <div className="font-mono text-xs leading-5 overflow-auto">
      {Array.from({ length: maxLen }, (_, i) => {
        const o = origLines[i]; const m = modLines[i]
        const bg = o === m ? 'transparent' : o === undefined ? 'rgba(0,200,100,0.1)' : m === undefined ? 'rgba(255,80,80,0.1)' : 'rgba(255,200,50,0.08)'
        return (
          <div key={i} className="flex" style={{ background: bg }}>
            <span className="w-12 text-right pr-2 text-[var(--app-text-tertiary)] select-none flex-shrink-0">{o !== undefined ? i + 1 : ''}</span>
            <span className="w-12 text-right pr-2 text-[var(--app-text-tertiary)] select-none flex-shrink-0">{m !== undefined ? i + 1 : ''}</span>
            <span className="w-4 text-center text-[var(--app-text-tertiary)] select-none flex-shrink-0">{o === m ? '' : o === undefined ? '+' : m === undefined ? '−' : '~'}</span>
            <span className="pl-2 text-[var(--app-text-primary)]">{m || o}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function DiffView(props: DiffViewProps) {
  const handleMount = (_editor: unknown, monaco: Monaco) => {
    monaco.editor.setTheme('vs-dark')
  }

  const lang = languageFromPath(props.language)

  return (
    <div className="flex-1 overflow-hidden">
      <DiffEditor
        original={props.original}
        modified={props.modified}
        language={lang}
        theme="vs-dark"
        options={{
          readOnly: true,
          renderSideBySide: props.mode === 'side-by-side',
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
        }}
        onMount={handleMount}
        loading={<FallbackDiff {...props} />}
      />
    </div>
  )
}
