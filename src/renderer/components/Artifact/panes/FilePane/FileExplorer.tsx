/**
 * FileExplorer — VS Code-aligned recursive tree directory navigator.
 *
 * Features:
 * - Virtualized rendering: only visible rows are rendered (ROW_HEIGHT + overscan).
 *   Flattens expanded tree into a flat array and clips to the scroll viewport.
 * - Async directory loading via IPC fs:read-dir.
 * - Right-click context menu (new file/folder, rename, delete, copy path).
 * - Active file highlight.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Plus, Trash2, Pencil, Copy } from 'lucide-react'
import { getApi } from '../../../../utils/api'

const ROW_HEIGHT = 26
const OVERSCAN = 10 // extra rows above/below viewport

interface TreeNode {
  name: string
  path: string
  isDir: boolean
  depth: number
}

interface FileExplorerProps {
  rootPath: string
  activeFilePath: string | null
  onFileClick: (path: string) => void
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  path: string
  type: 'file' | 'dir'
}

export default function FileExplorer({ rootPath, activeFilePath, onFileClick }: FileExplorerProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [childrenCache, setChildrenCache] = useState<Map<string, TreeNode[]>>(new Map())
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(400)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load root directory
  useEffect(() => {
    if (!rootPath) return
    loadChildren(rootPath).then((children) => {
      setRootNodes(children)
      setChildrenCache(new Map([[rootPath, children]]))
      setExpandedDirs(new Set())
    })
  }, [rootPath])

  // Measure viewport height
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewportHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  const loadChildren = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    try {
      const api = getApi()
      if (!api?.fs) return []

      const result = await api.fs.readDir(dirPath)
      if (!result.success || !result.entries) return []

      return result.entries
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        .map((entry) => ({
          name: entry.name,
          path: entry.path,
          isDir: entry.isDir,
          depth: 0, // depth assigned during flattening
        }))
    } catch (err) {
      console.warn('[FileExplorer] failed to load directory:', err)
      return []
    }
  }, [])

  // Flatten visible tree into a flat array (respecting expansion state)
  const flatNodes = useMemo(() => {
    const result: TreeNode[] = []
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const node of nodes) {
        result.push({ ...node, depth })
        if (node.isDir && expandedDirs.has(node.path)) {
          const children = childrenCache.get(node.path)
          if (children && children.length > 0) {
            walk(children, depth + 1)
          }
        }
      }
    }
    walk(rootNodes, 0)
    return result
  }, [rootNodes, expandedDirs, childrenCache])

  // Virtual scroll: compute visible range
  const totalHeight = flatNodes.length * ROW_HEIGHT
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIdx = Math.min(flatNodes.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
  const visibleNodes = flatNodes.slice(startIdx, endIdx)
  const offsetY = startIdx * ROW_HEIGHT

  const handleToggle = useCallback((node: TreeNode) => {
    if (!node.isDir) {
      onFileClick(node.path)
      return
    }

    const dirPath = node.path
    const isCurrentlyExpanded = expandedDirs.has(dirPath)

    // Load children asynchronously before expanding (if not cached)
    if (!isCurrentlyExpanded && !childrenCache.has(dirPath)) {
      loadChildren(dirPath).then((children) => {
        setChildrenCache((prev) => new Map(prev).set(dirPath, children))
      })
    }

    // Toggle expanded state (pure update, no side effects)
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) {
        next.delete(dirPath)
      } else {
        next.add(dirPath)
      }
      return next
    })
  }, [expandedDirs, childrenCache, loadChildren, onFileClick])

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault()
    setContextMenu({
      visible: true, x: e.clientX, y: e.clientY,
      path: node.path, type: node.isDir ? 'dir' : 'file',
    })
  }

  const ctxAction = useCallback(async (action: string) => {
    if (!contextMenu) return
    setContextMenu(null)
    const api = getApi()
    if (!api?.fs) return

    if (action === 'delete') await api.fs.delete(contextMenu.path)
    else if (action === 'newfile') { const name = prompt('File name:'); if (name) await api.fs.createFile(contextMenu.path + '/' + name, '') }
    else if (action === 'newdir') { const name = prompt('Directory name:'); if (name) await api.fs.createDir(contextMenu.path + '/' + name) }
    else if (action === 'copy-path') { navigator.clipboard.writeText(contextMenu.path).catch(() => {}); return }
    else if (action === 'rename') {
      const newName = prompt('New name:', contextMenu.path.split('/').pop())
      if (newName) {
        const parts = contextMenu.path.split('/'); parts.pop()
        await api.fs.rename(contextMenu.path, parts.join('/') + '/' + newName)
      }
    }

    // Reload parent directory
    const parentPath = contextMenu.path.split('/').slice(0, -1).join('/') || rootPath
    const children = await loadChildren(parentPath)
    setChildrenCache((prev) => new Map(prev).set(parentPath, children))
    if (parentPath === rootPath) setRootNodes(children)
  }, [contextMenu, rootPath, loadChildren])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden"
      onScroll={handleScroll}
    >
      {rootNodes.length === 0 ? (
        <div className="p-4 text-xs text-[var(--app-text-tertiary)] text-center">
          {rootPath ? 'Empty directory' : 'No folder open'}
        </div>
      ) : (
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Spacer for nodes above viewport */}
          <div style={{ height: offsetY }} />

          {/* Visible nodes */}
          {visibleNodes.map((node) => {
            const isExpanded = expandedDirs.has(node.path)
            const isActive = node.path === activeFilePath
            return (
              <div
                key={node.path}
                className={`flex items-center gap-0.5 cursor-pointer select-none text-xs transition-colors ${
                  isActive
                    ? 'bg-[var(--app-accent)]/20 text-[var(--app-accent)]'
                    : 'text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]'
                }`}
                style={{ height: ROW_HEIGHT, paddingLeft: `${node.depth * 16 + 4}px`, paddingRight: '4px' }}
                onClick={() => handleToggle(node)}
                onContextMenu={(e) => handleContextMenu(e, node)}
              >
                {/* Expand/collapse indicator */}
                {node.isDir && (
                  <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </span>
                )}
                {!node.isDir && <span className="w-4 flex-shrink-0" />}

                {/* Icon */}
                {node.isDir ? (
                  isExpanded
                    ? <FolderOpen className="w-3.5 h-3.5 text-[var(--app-warning)] flex-shrink-0" />
                    : <Folder className="w-3.5 h-3.5 text-[var(--app-warning)] flex-shrink-0" />
                ) : (
                  <File className="w-3.5 h-3.5 text-[var(--app-text-tertiary)] flex-shrink-0" />
                )}

                {/* Name */}
                <span className="truncate">{node.name}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Context menu */}
      {contextMenu?.visible && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 w-40 bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.type === 'dir' && (
              <>
                <button onClick={() => ctxAction('newfile')} className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] flex items-center gap-2">
                  <Plus className="w-3 h-3" /> New File
                </button>
                <button onClick={() => ctxAction('newdir')} className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] flex items-center gap-2">
                  <Plus className="w-3 h-3" /> New Folder
                </button>
                <div className="border-t border-[var(--app-border)] my-1" />
              </>
            )}
            <button onClick={() => ctxAction('rename')} className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] flex items-center gap-2">
              <Pencil className="w-3 h-3" /> Rename
            </button>
            <button onClick={() => ctxAction('delete')} className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] flex items-center gap-2">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
            <div className="border-t border-[var(--app-border)] my-1" />
            <button onClick={() => ctxAction('copy-path')} className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] flex items-center gap-2">
              <Copy className="w-3 h-3" /> Copy Path
            </button>
          </div>
        </>
      )}
    </div>
  )
}
