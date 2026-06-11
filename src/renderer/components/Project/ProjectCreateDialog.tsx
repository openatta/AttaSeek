/**
 * ProjectCreateDialog — modal form for creating a new project.
 * Requires: project name (non-empty) + project directory (must exist and be writable).
 */

import { useState, useRef } from 'react'
import { getApi } from '../../utils/api'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function ProjectCreateDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [rootPath, setRootPath] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false)

  if (!open) return null

  const isValid = name.trim().length > 0 && rootPath.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid || submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError('')

    try {
      const api = getApi()
      const result = await api.project.create(name.trim(), rootPath.trim())
      if (result.success && result.project) {
        onCreated()
        onClose()
        setName('')
        setRootPath('')
      } else {
        setError(result.error || '创建项目失败')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '创建项目失败'
      const code = (err as { code?: string }).code
      if (code === 'DIR_NOT_FOUND') {
        setError(`目录不存在: ${rootPath.trim()}。请确认路径后重试。`)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-xl shadow-2xl p-6 w-[420px] pointer-events-auto">
          <h2 className="text-sm font-semibold text-[var(--app-text-primary)] mb-4">创建项目</h2>

          {/* Project name */}
          <label className="block text-xs text-[var(--app-text-secondary)] mb-1">
            项目名称 <span className="text-[var(--app-error)]">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="MyApp"
            className="w-full h-[28px] px-2 text-xs bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] mb-3"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          />

          {/* Project directory */}
          <label className="block text-xs text-[var(--app-text-secondary)] mb-1">
            项目目录 <span className="text-[var(--app-error)]">*</span>
          </label>
          <div className="flex gap-2 mb-1">
            <input
              type="text"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="/Users/xbits/MyApp"
              className="flex-1 h-[28px] px-2 text-xs bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            />
            <button
              type="button"
              onClick={async () => {
                const api = getApi()
                const r = await api.app.selectDir()
                if (r.success && !r.canceled && r.path) setRootPath(r.path)
              }}
              className="px-3 h-[28px] text-xs rounded border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors flex-shrink-0"
            >
              选择...
            </button>
          </div>

          {error && (
            <div className="text-[11px] text-[var(--app-error)] mb-2">{error}</div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs rounded text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="px-4 py-1.5 text-xs rounded bg-[var(--app-accent)] text-white hover:bg-[var(--app-accent)]/80 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              {loading ? '创建中...' : '创建项目'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
