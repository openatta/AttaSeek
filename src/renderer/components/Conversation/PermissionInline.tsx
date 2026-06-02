/**
 * Inline permission confirmation — rendered in the message flow
 * instead of a modal dialog. Codex Desktop style.
 *
 * Props (wired later):
 * - message: string          — what the agent wants to do
 * - onAllowOnce: () => void  — allow this one call
 * - onAllowSession: () => void — allow all similar calls this session
 * - onDeny: () => void
 * - onDetails: () => void    — expand full context
 */
export default function PermissionInline() {
  return null // Skeleton — wired when agent integration is built
}
