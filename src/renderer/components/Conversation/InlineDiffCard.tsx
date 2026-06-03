interface InlineDiffCardProps {
  filename: string
  additions: number
  deletions: number
  onAccept?: () => void
  onReject?: () => void
}

export default function InlineDiffCard({
  filename,
  additions,
  deletions,
  onAccept,
  onReject
}: InlineDiffCardProps) {
  return (
    <div className="px-4 py-1">
      <div className="border border-[var(--app-border-muted)] rounded-lg bg-[var(--app-bg-inset)] px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--app-text)]">📄 {filename}</span>
          <span className="text-xs text-green-500">+{additions}</span>
          <span className="text-xs text-red-500">-{deletions}</span>
          <div className="flex-1" />
          <button
            onClick={onAccept}
            className="text-xs text-green-500 hover:text-green-400 px-2 py-0.5 rounded border border-green-500/30 hover:border-green-400 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={onReject}
            className="text-xs text-red-500 hover:text-red-400 px-2 py-0.5 rounded border border-red-500/30 hover:border-red-400 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
