/**
 * ModelConfigForm — add/edit form for a single LLM provider configuration.
 */

import { useState, useMemo } from 'react'
import type { ModelConfig, CreateModelConfig } from '../../../atoms/modelConfigAtom'
import { Wifi, Loader2, Eye, EyeOff, X, Check, AlertTriangle } from 'lucide-react'

interface Props {
  config?: ModelConfig
  onSaved: (config: ModelConfig | null) => void
  onCancel: () => void
}

interface TestStepInfo { step: number; label: string; status: string; detail: string; latencyMs?: number; requestInfo?: string; responseInfo?: string }

export default function ModelConfigForm({ config, onSaved, onCancel }: Props) {
  const isEdit = !!config
  const [name, setName] = useState(config?.name || '')
  const [interfaceType, setInterfaceType] = useState<'openai_compatible' | 'anthropic'>(config?.interfaceType || 'anthropic')
  const [endpointUrl, setEndpointUrl] = useState(config?.endpointUrl || (interfaceType === 'anthropic' ? 'https://api.anthropic.com' : ''))
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [defaultModel, setDefaultModel] = useState(config?.defaultModel || (interfaceType === 'anthropic' ? 'claude-sonnet-4-6' : ''))
  const [models, setModels] = useState(config?.models?.join(', ') || '')
  const [extraParams, setExtraParams] = useState(config?.extraParams ? JSON.stringify(config.extraParams, null, 2) : '')
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; ms?: number; error?: string; steps?: TestStepInfo[] } | null>(null)
  const [testing, setTesting] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)

  const jsonError = useMemo(() => {
    if (!extraParams.trim()) return null
    try { JSON.parse(extraParams); return null }
    catch { return 'Invalid JSON in Extra Parameters' }
  }, [extraParams])

  const handleInterfaceChange = (type: 'openai_compatible' | 'anthropic') => {
    setInterfaceType(type)
    if (!isEdit && !endpointUrl) setEndpointUrl(type === 'anthropic' ? 'https://api.anthropic.com' : '')
    if (!isEdit && !defaultModel) setDefaultModel(type === 'anthropic' ? 'claude-sonnet-4-6' : '')
  }

  const handleSave = async () => {
    if (!name.trim() || !endpointUrl.trim() || !defaultModel.trim()) return
    if (!isEdit && !apiKey.trim()) return
    if (jsonError) return

    setSaving(true)
    try {
      const modelList = models.split(',').map((m) => m.trim()).filter(Boolean)
      let extra: Record<string, unknown> | undefined
      if (extraParams.trim()) extra = JSON.parse(extraParams)

      const payload: CreateModelConfig = { name: name.trim(), interfaceType, endpointUrl: endpointUrl.trim(), apiKey: apiKey.trim(), models: modelList, defaultModel: defaultModel.trim(), extraParams: extra }

      if (isEdit) {
        const updatePayload: Record<string, unknown> = { name: payload.name, interfaceType: payload.interfaceType, endpointUrl: payload.endpointUrl, models: payload.models, defaultModel: payload.defaultModel, extraParams: payload.extraParams }
        if (apiKey.trim()) updatePayload.apiKey = apiKey.trim()
        const res = await window.api.model.update(config.id, updatePayload)
        onSaved((res as any).config || null)
      } else {
        const res = await window.api.model.create(payload as any)
        onSaved((res as any).config || null)
      }
    } catch (err) { console.error('[ModelConfigForm] save failed:', err) }
    finally { setSaving(false) }
  }

  const handleTest = async () => {
    if (!isEdit || !config) return
    setTesting(true)
    setTestResult(null)
    setShowTestModal(true)
    try {
      const res = await window.api.model.test(config.id)
      const data = res as any
      setTestResult({ ok: data.success, ms: data.latencyMs, error: data.error, steps: data.steps })
    } catch (err) {
      console.error('[ModelConfigForm] test failed:', err)
      setTestResult({ ok: false, error: 'Test request failed' })
    } finally { setTesting(false) }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--app-text)] mb-4">{isEdit ? `Edit "${config.name}"` : 'Add Model'}</h3>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My DeepSeek" className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]" />
        </div>
        <div>
          <label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Interface Type</label>
          <div className="flex gap-2">
            {(['anthropic', 'openai_compatible'] as const).map((t) => (
              <button key={t} onClick={() => handleInterfaceChange(t)} className={`px-3 py-1 text-xs rounded-md border transition-colors ${interfaceType === t ? 'border-[var(--app-accent)] bg-[var(--app-accent)]/10 text-[var(--app-accent)]' : 'border-[var(--app-border)] text-[var(--app-text-dim)] hover:text-[var(--app-text)]'}`}>{t === 'anthropic' ? 'Anthropic' : 'OpenAI Compatible'}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">API Endpoint URL</label>
          <input value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} placeholder="https://api.anthropic.com" className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] font-mono" />
        </div>
        <div>
          <label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">API Key {isEdit && '(stored securely — enter new key to change)'}</label>
          <div className="relative">
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type={showKey ? 'text' : 'password'} placeholder="sk-..." className="w-full px-3 py-1.5 pr-8 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] font-mono" />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--app-bg-hover)]" title={showKey ? 'Hide' : 'Show'}>
              {showKey ? <EyeOff className="w-3.5 h-3.5 text-[var(--app-text-dim)]" /> : <Eye className="w-3.5 h-3.5 text-[var(--app-text-dim)]" />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Default Model</label>
          <input value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} placeholder="claude-sonnet-4-6" className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]" />
        </div>
        <div>
          <label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Available Models (comma-separated)</label>
          <input value={models} onChange={(e) => setModels(e.target.value)} placeholder="claude-sonnet-4-6, claude-haiku-4-5-20251001, claude-opus-4-8" className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]" />
          {!isEdit && interfaceType === 'anthropic' && !models && <p className="text-[10px] text-[var(--app-text-dim)] mt-1">Default: claude-sonnet-4-6, claude-haiku-4-5-20251001, claude-opus-4-8</p>}
        </div>
        <div>
          <label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Extra Parameters (JSON, optional)</label>
          <textarea value={extraParams} onChange={(e) => setExtraParams(e.target.value)} placeholder='{ "temperature": 0.7 }' rows={3} className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] font-mono resize-none" />
          {jsonError && <p className="text-[11px] text-red-400 mt-1">{jsonError}</p>}
        </div>

        {/* Test result banner */}
        {testResult && (
          <div className={`p-2 rounded border text-xs ${testResult.ok ? 'border-green-500/30 bg-green-500/5 text-green-400' : 'border-red-500/30 bg-red-500/5 text-red-400'}`}>
            {testResult.ok ? `✓ Connected · ${testResult.ms}ms` : `✗ ${testResult.error || 'Connection failed'}`}
          </div>
        )}
      </div>

      {/* Actions: Test | Cancel | Confirm */}
      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[var(--app-border)]">
        <button onClick={handleTest} disabled={testing || !isEdit} className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)] disabled:opacity-40">
          {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />} Test
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 rounded-md text-xs border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)]">Cancel</button>
        <button onClick={handleSave} disabled={saving || !!jsonError} className="px-4 py-1.5 rounded-md text-xs bg-[var(--app-accent)] text-white hover:opacity-90 disabled:opacity-50">{saving ? 'Saving…' : 'Confirm'}</button>
      </div>

      {/* Test progress/detail modal — manual close only */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => {}}>
          <div className="bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-xl p-5 shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--app-text)]">Connection Test</h3>
              <button onClick={() => { setShowTestModal(false); setTesting(false) }} className="p-1 rounded hover:bg-[var(--app-bg-hover)]"><X className="w-4 h-4 text-[var(--app-text-dim)]" /></button>
            </div>

            <div className="space-y-3">
              {/* Step 1: always shown */}
              <StepRow step={1} label="Network Reachability" status={testing ? 'running' : testResult?.steps?.[0]?.status || 'pending'} detail={testResult?.steps?.[0]?.detail} latency={testResult?.steps?.[0]?.latencyMs} req={testResult?.steps?.[0]?.requestInfo} res={testResult?.steps?.[0]?.responseInfo} />

              {/* Step 2: shown if step 1 passed */}
              {(testResult?.steps?.length || 0) >= 2 || testing ? (
                <StepRow step={2} label="API Key" status={testing ? 'pending' : testResult?.steps?.[1]?.status || 'pending'} detail={testResult?.steps?.[1]?.detail} req={testResult?.steps?.[1]?.requestInfo} />
              ) : null}

              {/* Step 3: shown if step 2 passed */}
              {(testResult?.steps?.length || 0) >= 3 || testing ? (
                <StepRow step={3} label="API Call Validation" status={testing ? 'pending' : testResult?.steps?.[2]?.status || 'pending'} detail={testResult?.steps?.[2]?.detail} latency={testResult?.steps?.[2]?.latencyMs} req={testResult?.steps?.[2]?.requestInfo} res={testResult?.steps?.[2]?.responseInfo} />
              ) : null}
            </div>

            {/* Summary */}
            {!testing && testResult && (
              <div className={`mt-3 p-2 rounded text-xs ${testResult.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {testResult.ok ? 'All checks passed — model is ready to use' : `Test failed: ${testResult.error || 'unknown error'}`}
              </div>
            )}

            <button onClick={() => setShowTestModal(false)} className="mt-4 w-full py-2 rounded-md text-xs border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

function StepRow({ step, label, status, detail, latency, req, res }: { step: number; label: string; status: string; detail?: string; latency?: number; req?: string; res?: string }) {
  const icon = status === 'ok' ? <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> : status === 'fail' ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" /> : status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--app-accent)] flex-shrink-0" /> : <span className="w-3.5 h-3.5 flex-shrink-0" />
  return (
    <div className={`p-2 rounded border text-xs ${status === 'fail' ? 'border-red-500/20 bg-red-500/5' : status === 'ok' ? 'border-green-500/20 bg-green-500/5' : 'border-[var(--app-border)] bg-[var(--app-bg-inset)]'}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="font-medium text-[var(--app-text)]">Step {step}: {label}</span>
        {latency !== undefined && <span className="text-[var(--app-text-dim)] ml-auto">{latency}ms</span>}
      </div>
      {detail && <p className="text-[var(--app-text-secondary)] ml-5.5 mb-1">{detail}</p>}
      {req && <p className="text-[10px] text-[var(--app-text-dim)] ml-5.5 truncate">Req: {req}</p>}
      {res && <p className="text-[10px] text-[var(--app-text-dim)] ml-5.5 truncate">Res: {res}</p>}
    </div>
  )
}
