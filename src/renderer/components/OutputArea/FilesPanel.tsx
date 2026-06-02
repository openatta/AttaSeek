export default function FilesPanel() {
  return (
    <div className="flex h-full">
      {/* File tree placeholder */}
      <div className="w-56 border-r border-neutral-800 flex items-center justify-center">
        <p className="text-xs text-neutral-600">File tree — coming soon</p>
      </div>
      {/* Editor placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-neutral-600">Monaco Editor — open a file to edit</p>
      </div>
    </div>
  )
}
