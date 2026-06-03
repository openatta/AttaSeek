import { useState } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react'
import { MOCK_FILE_TREE, type TreeNode } from '../../workspaces/mock/projects'

function FileTreeRow({ node, depth, selectedPath, onSelect }: {
  node: TreeNode
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)

  const isDir = node.type === 'directory'
  const isSelected = selectedPath === node.path

  return (
    <>
      <button
        onClick={() => {
          if (isDir) setExpanded(!expanded)
          else onSelect(node.path)
        }}
        className={`w-full flex items-center gap-1 text-left text-xs py-1 transition-colors
          ${isSelected
            ? 'bg-[var(--app-bg-active)] text-[var(--app-text)]'
            : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]'
          }`}
        style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: '8px' }}
      >
        {isDir ? (
          expanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        {isDir ? (
          expanded ? <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-[var(--app-text-dim)]" /> : <Folder className="w-3.5 h-3.5 flex-shrink-0 text-[var(--app-text-dim)]" />
        ) : (
          <File className="w-3.5 h-3.5 flex-shrink-0 text-[var(--app-text-dim)]" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && expanded && node.children?.map((child) => (
        <FileTreeRow
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

export default function FilesPanel() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const content = selectedFile
    ? `// ${selectedFile}\n\n// File content preview — Monaco Editor integration coming soon.\n\n`
    : null

  return (
    <div className="flex h-full">
      {/* Directory tree */}
      <div className="w-56 border-r border-[var(--app-border)] overflow-y-auto py-1">
        <div className="px-3 py-1 text-[10px] text-[var(--app-text-dim)] uppercase tracking-wider mb-1">
          Explorer
        </div>
        {MOCK_FILE_TREE.map((node) => (
          <FileTreeRow
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedFile}
            onSelect={setSelectedFile}
          />
        ))}
      </div>

      {/* File content / empty state */}
      <div className="flex-1 overflow-y-auto">
        {content ? (
          <pre className="p-4 text-xs text-[var(--app-text)] font-mono leading-relaxed whitespace-pre">
            {content}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-[var(--app-text-dim)]">Select a file to view its contents</p>
          </div>
        )}
      </div>
    </div>
  )
}
