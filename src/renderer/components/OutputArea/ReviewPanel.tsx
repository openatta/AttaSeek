export default function ReviewPanel() {
  return (
    <div className="flex h-full">
      {/* Changed files list */}
      <div className="w-52 border-r border-neutral-800 p-3">
        <h4 className="text-xs font-medium text-neutral-400 mb-2">Changed Files</h4>
        <p className="text-xs text-neutral-600">No changes to review</p>
      </div>
      {/* Diff view */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-neutral-600">Monaco Diff Editor — select a file to review</p>
      </div>
    </div>
  )
}
