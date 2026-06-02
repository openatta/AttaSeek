export default function TerminalPanel() {
  return (
    <div className="flex items-center justify-center h-full bg-neutral-950">
      <p className="text-xs text-neutral-600 font-mono">
        $ _<span className="animate-pulse ml-0.5">│</span>
      </p>
    </div>
  )
}
