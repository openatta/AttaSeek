/** Lightweight Markdown renderer for Conversation messages. Uses react-markdown + remark-gfm. */
import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check } from 'lucide-react'

/** Basic regex-based syntax highlighting. Covers common language keywords, strings, comments, numbers. */
function highlightCode(code: string, lang: string): string {
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const keywords = /\b(function|const|let|var|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|true|false|null|undefined|def|print|self|endif|end|begin|rescue|ensure|do|end|module|private|protected|public|static|int|float|double|string|boolean|void|interface|type|enum|extends|implements|package|fn|mut|pub|use|mod|struct|impl|match|where|in|not|and|or|is|lambda|elif|except|finally|raise|with|yield|switch|case|break|continue|default|goto)\b/g
  const strings = /("[^"]*"|'[^']*'|`[^`]*`)/g
  const comments = /(\/\/[^\n]*|#[^\n]*)/g
  const numbers = /\b(\d+\.?\d*)\b/g

  let html = escaped
  html = html.replace(comments, '<span style="color:#6a9955">$1</span>')
  html = html.replace(strings, '<span style="color:#ce9178">$1</span>')
  html = html.replace(keywords, '<span style="color:#569cd6">$1</span>')
  html = html.replace(numbers, '<span style="color:#b5cea8">$1</span>')
  return html
}

function CodeBlock({ className, children, ...props }: any) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const lang = match ? match[1] : ''
  const raw = String(children).replace(/\n$/, '')
  const highlighted = useMemo(() => highlightCode(raw, lang), [raw, lang])

  return (
    <div className="relative my-3 rounded-lg overflow-hidden border border-[var(--app-border)]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] text-[11px] text-gray-400">
        <span>{lang || 'code'}</span>
        <button onClick={() => { navigator.clipboard.writeText(raw).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {}) }}
          className="flex items-center gap-1 hover:text-white transition-colors">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 bg-[#1e1e1e] text-sm text-gray-200 overflow-x-auto font-mono leading-relaxed">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }: any) {
          const isInline = !className
          if (isInline) return <code className="bg-[var(--app-bg-active)] px-1 py-0.5 rounded text-[var(--app-accent)] text-sm font-mono" {...props}>{children}</code>
          return <CodeBlock className={className} {...props}>{children}</CodeBlock>
        },
        a({ href, children }: any) {
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--app-accent)] underline hover:opacity-80">{children}</a>
        },
        table({ children }: any) {
          return <div className="overflow-x-auto my-3"><table className="min-w-full border-collapse border border-[var(--app-border)] text-sm">{children}</table></div>
        },
        th({ children }: any) {
          return <th className="border border-[var(--app-border)] px-3 py-1.5 bg-[var(--app-bg-active)] text-[var(--app-text)] font-medium text-left">{children}</th>
        },
        td({ children }: any) {
          return <td className="border border-[var(--app-border)] px-3 py-1.5 text-[var(--app-text-secondary)]">{children}</td>
        },
        p({ children }: any) {
          return <p className="my-2 leading-relaxed">{children}</p>
        },
        ul({ children }: any) {
          return <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
        },
        ol({ children }: any) {
          return <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
        },
        h1({ children }: any) { return <h1 className="text-lg font-bold my-3">{children}</h1> },
        h2({ children }: any) { return <h2 className="text-base font-bold my-2.5">{children}</h2> },
        h3({ children }: any) { return <h3 className="text-sm font-bold my-2">{children}</h3> },
        blockquote({ children }: any) {
          return <blockquote className="border-l-3 border-[var(--app-accent)]/40 pl-3 my-2 text-[var(--app-text-dim)] italic">{children}</blockquote>
        },
        hr() { return <hr className="my-4 border-[var(--app-border)]" /> },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
