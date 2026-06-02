/**
 * Title bar region that aligns with the sidebar area.
 * On macOS with hiddenInset title bar style, the traffic lights
 * (close/minimize/fullscreen) are rendered by the OS in this area.
 * On Windows/Linux with titleBarOverlay, the OS renders
 * window controls overlaying this same region.
 *
 * Height: 40px (unified with SessionHeader and Sidebar header).
 * No bottom border — only SessionHeader has the visual separator.
 */
export default function TitleBar() {
  return (
    <div className="flex-shrink-0 h-[40px] flex items-center px-3">
      {/* macOS traffic lights rendered by OS in this area */}
      {/* Windows/Linux: overlay controls rendered by OS */}
      <span className="text-[11px] text-neutral-600 select-none">AttaSeek</span>
    </div>
  )
}
