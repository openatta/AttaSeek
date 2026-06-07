/**
 * ModelSettings — list view of configured LLM providers.
 */

import { useEffect, useState } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { modelConfigsAtom, type ModelConfig } from '../../../atoms/modelConfigAtom'
import ModelConfigForm from './ModelConfigForm'
import ErrorDetails from '../../ErrorDetails'
import { Plus, Star, Plug, Unplug, Clock, Loader2 } from 'lucide-react'

export default function ModelSettings() {
  const [configs, setConfigs] = useAtom(modelConfigsAtom)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; ms?: number; error?: string; errorCode?: string }>>({})
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Load configs on mount
  useEffect(() => {
    ;(async () => {
      try {
        const res = await window.api.model.list()
        if (res.configs) setConfigs(res.configs)
      } catch (err) { console.error('[ModelSettings] load configs failed:', err) }
    })()
  }, [])

  const handleDeleteRequest = (id: string) => {
    setDeleteConfirm(id)
  }

  const handleDeleteConfirm = async () => {
    const id = deleteConfirm; if (!id) return
    setDeleting(true)
    try {
      const res = await window.api.model.delete(id)
      if (res.success) {
        setConfigs((prev) => prev.filter((c) => c.id !== id))
        setDeleteConfirm(null)
      } else {
        console.error('[ModelSettings] delete returned false for', id)
        setDeleteConfirm(null)
      }
    } catch (err) {
      console.error('[ModelSettings] delete failed:', err)
      setDeleteConfirm(null)
    } finally { setDeleting(false) }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await window.api.model.setDefault(id)
      setConfigs((prev) =>
        prev.map((c) => ({ ...c, isDefault: c.id === id })),
      )
    } catch (err) { console.error('[ModelSettings] set default failed:', err) }
  }

  const handleTest = async (id: string) => {
    if (testingIds.has(id)) return // prevent concurrent tests on same config
    setTestingIds((prev) => new Set(prev).add(id))
    try {
      const res = await window.api.model.test(id)
      setTestResults((prev) => ({
        ...prev,
        [id]: { ok: res.success, ms: res.latencyMs, error: res.error, errorCode: res.errorCode },
      }))
    } catch (err) { console.error('[ModelSettings] test failed:', err) }
      finally { setTestingIds((prev) => { const s = new Set(prev); s.delete(id); return s }) }
  }

  if (editingId) {
    const config = configs.find((c) => c.id === editingId)
    return (
      <div>
        <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 text-xs text-[var(--app-text-dim)] hover:text-[var(--app-text)] mb-4">← Back</button>
        <ModelConfigForm config={config}
          onSaved={(updated) => {
            setConfigs((prev) => updated ? prev.map(c => c.id === updated.id ? updated : c) : prev)
            setEditingId(null)
          }}
        onCancel={() => setEditingId(null)}
      />
      </div>
    )
  }

  if (showAdd) {
    return (
      <div>
        <button onClick={() => setShowAdd(false)} className="inline-flex items-center gap-1 text-xs text-[var(--app-text-dim)] hover:text-[var(--app-text)] mb-4">← Back</button>
        <ModelConfigForm onSaved={(c) => { if (c) setConfigs(prev => [...prev, c]); setShowAdd(false) }} onCancel={() => setShowAdd(false)} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--app-text)]">Model Configure</h3>
      </div>

      {configs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--app-text-secondary)] mb-1">No model configured</p>
          <p className="text-xs text-[var(--app-text-dim)] mb-3">
            Add an LLM provider to start using the agent.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Model
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {configs.map((config) => (
            <ModelCard
              key={config.id}
              config={config}
              testResult={testResults[config.id]}
              testing={testingIds.has(config.id)}
              onEdit={() => setEditingId(config.id)}
              onDelete={() => handleDeleteRequest(config.id)}
              onSetDefault={() => handleSetDefault(config.id)}
              onTest={() => handleTest(config.id)}
            />
          ))}
          <button onClick={() => setShowAdd(true)} className="w-full mt-2 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs border border-dashed border-[var(--app-border)] text-[var(--app-text-dim)] hover:text-[var(--app-text)] hover:border-[var(--app-text-dim)] transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Model
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-xl p-4 max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xs font-semibold text-[var(--app-text)] mb-2">Delete Configuration</h3>
            <p className="text-[11px] text-[var(--app-text-dim)] mb-4">Are you sure you want to delete this model configuration? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="px-3 py-1 rounded-md text-xs border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)]">Cancel</button>
              <button onClick={handleDeleteConfirm} disabled={deleting} className="px-3 py-1 rounded-md text-xs bg-red-500 text-white hover:opacity-90 disabled:opacity-40">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModelCard({
  config,
  testResult,
  testing,
  onEdit, onDelete, onSetDefault, onTest,
}: {
  config: ModelConfig
  testResult?: { ok: boolean; ms?: number; error?: string; errorCode?: string }
  testing?: boolean
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
  onTest: () => void
}) {
  return (
    <div className={`border rounded-lg p-3 transition-colors ${config.isDefault ? 'border-[var(--app-accent)]/30 bg-[var(--app-accent)]/5' : 'border-[var(--app-border)] bg-[var(--app-bg-inset)]'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {config.isDefault && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--app-accent)]/10 text-[var(--app-accent)]">
              Default
            </span>
          )}
          <span className="text-xs font-medium text-[var(--app-text)]">{config.name}</span>
        </div>
        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={onTest}
            disabled={testing}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : testResult ? (
              testResult.ok
                ? <Plug className="w-3 h-3 text-green-400" />
                : <Unplug className="w-3 h-3 text-red-400" />
            ) : (
              <Plug className="w-3 h-3" />
            )}
            Test Connection
          </button>
          <button onClick={onEdit}
            className="px-2 py-1 rounded text-[10px] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]">
            Edit
          </button>
          <button onClick={onDelete}
            className="px-2 py-1 rounded text-[10px] border border-red-500/20 text-red-400 hover:bg-red-500/10">
            Delete
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--app-text-dim)]">
        <span>{config.interfaceType === 'anthropic' ? 'Anthropic' : 'OpenAI Compat'}</span>
        <span>{config.models.length} models ({config.defaultModel})</span>
        {testResult?.ok && testResult.ms && (
          <span className="flex items-center gap-1 text-green-400">
            <Clock className="w-3 h-3" />
            Connected · {testResult.ms}ms
          </span>
        )}
      </div>
      {testResult && !testResult.ok && testResult.error && (
        <ErrorDetails message={testResult.errorCode === 'network_unreachable' ? 'Network unreachable'
          : testResult.errorCode === 'auth_failed' ? 'Auth failed'
          : testResult.errorCode === 'model_not_found' ? 'Model not found'
          : 'Connection failed'} details={testResult.error} />
      )}
    </div>
  )
}
