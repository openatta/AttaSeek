interface AgentMessageProps {
  content: string
}

export default function AgentMessage({ content }: AgentMessageProps) {
  return (
    <div className="px-4 py-2">
      <div className="text-sm text-[var(--app-text)] leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  )
}
