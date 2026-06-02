/**
 * Title bar region that aligns with the sidebar area.
 * On macOS with hiddenInset title bar style, the traffic lights
 * (close/minimize/fullscreen) are rendered by the OS in this area.
 * We leave a draggable spacer that the OS positions the lights on.
 *
 * On Windows/Linux with titleBarOverlay, the OS renders
 * window controls overlaying this same region.
 */
export default function TitleBar() {
  return (
    <div className="flex-shrink-0 border-b border-neutral-800">
      {/* Traffic lights spacer — macOS renders lights here */}
      {/* On Windows/Linux the overlay controls appear here */}
      <div className="h-8 w-full flex items-center px-3">
        <span className="text-[11px] text-neutral-600 select-none">
          AttaSeek
        </span>
      </div>
    </div>
  )
}
