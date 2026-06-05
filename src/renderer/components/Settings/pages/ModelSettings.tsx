/**
 * ModelSettings — list view of configured LLM providers.
 */

import { useEffect, useState } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { modelConfigsAtom, type ModelConfig } from '../../../atoms/modelConfigAtom'
import ModelConfigForm from './ModelConfigForm'
import ErrorDetails from '../../ErrorDetails'
import { Plus, Star, Radio, Wifi, WifiOff, Clock, Loader2 } from 'lucide-react'

export default function ModelSettings() {
  const [configs, setConfigs] = useAtom(modelConfigsAtom)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; ms?: number; error?: string; errorCode?: string }>>({})
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set())

  // Load configs on mount
  useEffect(() => {
    ;(async () => {
      try {
        const res = await window.api.model.list()
        if ((res as any).configs) setConfigs((res as any).configs)
      } catch (err) { console.error('[ModelSettings] load configs failed:', err) }
    })()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this model configuration?')) return
    try {
      const res = await window.api.model.delete(id)
      if ((res as any).success) {
        setConfigs((prev) => prev.filter((c) => c.id !== id))
      }
    } catch (err) { console.error('[ModelSettings] delete failed:', err) }
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
      const data = res as any
      setTestResults((prev) => ({
        ...prev,
        [id]: { ok: data.success, ms: data.latencyMs, error: data.error, errorCode: data.errorCode },
      }))
    } catch (err) { console.error('[ModelSettings] test failed:', err) }
      finally { setTestingIds((prev) => { const s = new Set(prev); s.delete(id); return s }) }
  }

  if (editingId) {
    const config = configs.find((c) => c.id === editingId)
    return (
      <ModelConfigForm
        config={config}
        onSaved={(updated) => {
          setConfigs((prev) =>
            updated
              ? prev.map((c) => (c.id === updated.id ? updated : c))
              : prev,
          )
          setEditingId(null)
        }}
        onCancel={() => setEditingId(null)}
      />
    )
  }

  if (showAdd) {
    return (
      <ModelConfigForm
        onSaved={(created) => {
          if (created) setConfigs((prev) => [...prev, created])
          setShowAdd(false)
        }}
        onCancel={() => setShowAdd(false)}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--app-text)]">Model Configure</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs bg-[var(--app-accent)] text-white hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Model
        </button>
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
              onDelete={() => handleDelete(config.id)}
              onSetDefault={() => handleSetDefault(config.id)}
              onTest={() => handleTest(config.id)}
            />
          ))}
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
                ? <Wifi className="w-3 h-3 text-green-400" />
                : <WifiOff className="w-3 h-3 text-red-400" />
            ) : (
              <Radio className="w-3 h-3" />
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
