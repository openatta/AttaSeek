export default function BrowserPanel() {
  return (
    <div className="flex flex-col h-full">
      {/* Address bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-neutral-800">
        <input
          type="text"
          placeholder="Enter URL..."
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-xs text-neutral-300 placeholder-neutral-600 outline-none focus:border-neutral-500"
        />
      </div>
      {/* Viewport placeholder */}
      <div className="flex-1 flex items-center justify-center bg-neutral-900/30">
        <p className="text-xs text-neutral-600">Browser — Enter a URL to load</p>
      </div>
    </div>
  )
}
