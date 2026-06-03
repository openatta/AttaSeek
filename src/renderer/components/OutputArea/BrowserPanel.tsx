export default function BrowserPanel() {
  return (
    <div className="flex flex-col h-full">
      {/* Address bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--app-border)]">
        <input
          type="text"
          placeholder="Enter URL..."
          className="flex-1 bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded px-2 py-0.5 text-xs text-[var(--app-text)] placeholder:text-[var(--app-text-dim)] outline-none focus:border-[var(--app-accent)]"
        />
      </div>
      {/* Viewport placeholder */}
      <div className="flex-1 flex items-center justify-center bg-[var(--app-bg-inset)]/30">
        <p className="text-xs text-[var(--app-text-dim)]">Browser — Enter a URL to load</p>
      </div>
    </div>
  )
}
