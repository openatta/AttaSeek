/** Code block component for MarkdownRenderer — syntax highlighting + copy button. */
import { useMemo } from 'react'
import { Copy, Check } from 'lucide-react'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'

const KEYWORD_RE = /\b(function|const|let|var|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|true|false|null|undefined|def|print|self|endif|end|begin|rescue|ensure|do|end|module|private|protected|public|static|int|float|double|string|boolean|void|interface|type|enum|extends|implements|package|fn|mut|pub|use|mod|struct|impl|match|where|in|not|and|or|is|lambda|elif|except|finally|raise|with|yield|switch|case|break|continue|default|goto)\b/g
const STRING_RE = /("[^"]*"|'[^']*'|`[^`]*`)/g
const COMMENT_RE = /(\/\/[^\n]*|#[^\n]*)/g
const NUMBER_RE = /\b(\d+\.?\d*)\b/g

function highlightCode(code: string): string {
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let html = escaped
  html = html.replace(COMMENT_RE, '<span style="color:#6a9955">$1</span>')
  html = html.replace(STRING_RE, '<span style="color:#ce9178">$1</span>')
  html = html.replace(KEYWORD_RE, '<span style="color:#569cd6">$1</span>')
  html = html.replace(NUMBER_RE, '<span style="color:#b5cea8">$1</span>')
  return html
}

export default function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, copy] = useCopyToClipboard()
  const match = /language-(\w+)/.exec(className || '')
  const lang = match ? match[1] : ''
  const raw = String(children).replace(/\n$/, '')
  const highlighted = useMemo(() => highlightCode(raw), [raw])

  return (
    <div className="relative my-3 rounded-lg overflow-hidden border border-[var(--app-border)]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] text-[11px] text-gray-400">
        <span>{lang || 'code'}</span>
        <button onClick={() => copy(raw)}
          className="flex items-center gap-1 hover:text-white transition-colors">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[13px] leading-relaxed bg-[#1e1e1e] text-[#d4d4d4]">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}
