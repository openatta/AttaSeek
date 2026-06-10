import { useRef, useState, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { streamingBuffersAtom } from '../../../atoms/sessionAtom'
import type { AgentMessagePayload } from '../../../../shared/types/SessionEvent'
import { Copy, Check, RefreshCw } from 'lucide-react'
import MarkdownRenderer from '../MarkdownRenderer'
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard'

interface Props { payload: AgentMessagePayload; streamingMessageId?: string; onRegenerate?: () => void }

/** After this many ms without content, show "推理中..." instead of "Thinking..." */
const REASONING_THRESHOLD_MS = 3000

export default function AgentMessageEvent({ payload, streamingMessageId, onRegenerate }: Props) {
  const streamingBuffers = useAtomValue(streamingBuffersAtom)
  const streamingContent = streamingMessageId ? streamingBuffers[streamingMessageId] : undefined
  const displayContent = streamingContent || payload.content
  const hasContent = !!payload.content
  const isStreaming = !hasContent
  const [copied, copy] = useCopyToClipboard()
  const waitingSince = useRef<number>(Date.now())
  const [showReasoning, setShowReasoning] = useState(false)

  // Switch to "推理中..." after REASONING_THRESHOLD_MS without content.
  // DeepSeek v4-pro and similar reasoning models spend seconds on internal
  // reasoning before emitting any visible output.
  useEffect(() => {
    if (hasContent) {
      setShowReasoning(false)
      return
    }
    waitingSince.current = Date.now()
    const timer = setTimeout(() => setShowReasoning(true), REASONING_THRESHOLD_MS)
    return () => clearTimeout(timer)
  }, [hasContent, streamingContent])

  const handleCopy = () => copy(displayContent || '')

  return (
    <div className="py-2">
      {hasContent ? (
        <MarkdownRenderer content={displayContent} />
      ) : isStreaming ? (
        <span className="inline-flex items-center gap-1 text-[var(--app-text-secondary)] animate-pulse">
          {showReasoning ? '推理中' : 'Thinking'}<span className="inline-flex gap-0.5 mx-0.5">···</span>
        </span>
      ) : null}

      {/* Action buttons — always visible when content exists and streaming is done */}
      {hasContent && !isStreaming && (
        <div className="flex gap-1 mt-2">
          <button onClick={handleCopy} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {onRegenerate && (
            <button onClick={onRegenerate} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors">
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
