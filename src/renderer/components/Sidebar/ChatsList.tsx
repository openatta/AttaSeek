export default function ChatsList() {
  return (
    <div className="flex flex-col flex-1">
      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <input
            type="text"
            placeholder="搜索会话..."
            className="w-full bg-[var(--app-bg-inset)] border border-[var(--app-border)]
                       rounded-md px-3 py-1.5 text-xs text-[var(--app-text)]
                       placeholder:text-[var(--app-text-dim)] outline-none
                       focus:border-[var(--app-accent)] focus:ring-1 focus:ring-[var(--app-accent-border)]
                       transition-colors"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 px-3 pb-3">
        {['全部', '进行中', '归档'].map((f) => (
          <button
            key={f}
            className="px-2 py-0.5 text-[11px] rounded-full border border-[var(--app-border)]
                       text-[var(--app-text-secondary)] hover:text-[var(--app-text)]
                       hover:border-[var(--app-text-dim)] transition-colors"
          >
            {f}
          </button>
        ))}
      </div>

      {/* Chat list placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-[var(--app-text-dim)]">No conversations yet</p>
      </div>
    </div>
  )
}
