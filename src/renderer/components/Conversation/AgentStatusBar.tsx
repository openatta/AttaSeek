/**
 * Agent status indicator bar.
 * Only visible when the agent is active (thinking/executing/waiting for permission).
 * Completely hidden when idle.
 *
 * States:
 * - idle: hidden
 * - thinking: shows current operation + animated indicator
 * - waiting_permission: shows prompt + jump-to-pending button
 * - error: shows error summary + [retry] [skip] [copy log]
 */
export default function AgentStatusBar() {
  // Hidden when idle — uncomment below when agent state atom is wired
  return null

  /* Example active state:
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/5 border-b border-blue-500/10 animate-pulse">
      <span className="w-2 h-2 rounded-full bg-blue-400" />
      <span className="text-xs text-blue-300">Analyzing src/api.ts...</span>
      <div className="flex-1" />
      <button className="text-xs text-neutral-500 hover:text-neutral-300">■ Stop</button>
    </div>
  )
  */
}
