export default function TerminalPanel() {
  return (
    <div className="flex items-center justify-center h-full bg-[var(--app-bg)]">
      <p className="text-xs text-[var(--app-text-dim)] font-mono">
        $ _<span className="animate-pulse ml-0.5">│</span>
      </p>
    </div>
  )
}
