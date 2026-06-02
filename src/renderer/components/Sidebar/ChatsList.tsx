export default function ChatsList() {
  return (
    <div className="flex flex-col flex-1">
      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <input
            type="text"
            placeholder="搜索会话..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-1.5
                       text-xs text-neutral-300 placeholder-neutral-600 outline-none
                       focus:border-neutral-500 transition-colors"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 px-3 pb-3">
        {['全部', '进行中', '归档'].map((f) => (
          <button
            key={f}
            className="px-2 py-0.5 text-[11px] rounded-full border border-neutral-700
                       text-neutral-400 hover:text-neutral-200 hover:border-neutral-600
                       transition-colors"
          >
            {f}
          </button>
        ))}
      </div>

      {/* Chat list placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-neutral-600">No conversations yet</p>
      </div>
    </div>
  )
}
