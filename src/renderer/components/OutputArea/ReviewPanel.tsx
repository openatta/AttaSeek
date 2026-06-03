export default function ReviewPanel() {
  return (
    <div className="flex h-full">
      {/* Changed files list */}
      <div className="w-52 border-r border-[var(--app-border)] p-3">
        <h4 className="text-xs font-medium text-[var(--app-text-secondary)] mb-2">Changed Files</h4>
        <p className="text-xs text-[var(--app-text-dim)]">No changes to review</p>
      </div>
      {/* Diff view */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-[var(--app-text-dim)]">Monaco Diff Editor — select a file to review</p>
      </div>
    </div>
  )
}
