/** Lightweight Markdown renderer for Conversation messages. Uses react-markdown + remark-gfm. */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CodeBlock from './CodeBlock'

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }: any) {
          const isInline = !className
          if (isInline) return <code className="bg-[var(--app-bg-active)] px-1 py-0.5 rounded text-[var(--app-accent)] text-sm font-mono" {...props}>{children}</code>
          return <CodeBlock className={className}>{children}</CodeBlock>
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
