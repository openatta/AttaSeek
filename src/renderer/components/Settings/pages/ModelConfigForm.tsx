/**
 * ModelConfigForm — add/edit LLM provider configuration.
 * Split by interface type: Anthropic vs OpenAI Compatible have different fields.
 */

import { useState, useEffect, useMemo } from 'react'
import type { ModelConfig, CreateModelConfig } from '../../../atoms/modelConfigAtom'
import { type UITemplate, BUILTIN_TEMPLATES, toUITemplates } from '../../../../shared/types/model'
import { Plug, Unplug, Loader2, Eye, EyeOff, X, Check, AlertTriangle, ChevronDown } from 'lucide-react'

interface Props { config?: ModelConfig; onSaved: (config: ModelConfig | null) => void; onCancel: () => void; onCreated?: (config: ModelConfig) => void }
interface TestStepInfo { step: number; label: string; status: string; detail: string; latencyMs?: number }

const TEMPLATES: UITemplate[] = toUITemplates(BUILTIN_TEMPLATES)

export default function ModelConfigForm({ config, onSaved, onCancel, onCreated }: Props) {
  const isEdit = !!config
  // Detect template from existing config
  const detectedTemplate = isEdit ? TEMPLATES.find(t => t.endpoint === config?.endpointUrl) : null
  const [templateId, setTemplateId] = useState(detectedTemplate?.id || '')
  const [name, setName] = useState(config?.name || '')
  const [interfaceType, setInterfaceType] = useState<'openai_compatible' | 'anthropic'>(config?.interfaceType || 'anthropic')
  const [apiKey, setApiKey] = useState('')
  // Per-interface template data including slot defaults
  type TmplEntry = { endpoint: string; models: string; dmodel: string; slots?: { opusModel?: string; sonnetModel?: string; haikuModel?: string; effortLevel?: string; maxTokens?: number } }
  // Init tmplData from detected template (editing) or empty (new). Keys match ApiType values.
  const initData: Record<string, TmplEntry | undefined> = {}
  if (detectedTemplate) {
    if (detectedTemplate.endpoint) {
      initData[detectedTemplate.iface] = { endpoint: detectedTemplate.endpoint, models: detectedTemplate.models, dmodel: detectedTemplate.dmodel, slots: detectedTemplate.slots }
    }
    if (detectedTemplate.altEndpoint) {
      const altIface = detectedTemplate.iface === 'anthropic' ? 'openai_compatible' : 'anthropic'
      initData[altIface] = { endpoint: detectedTemplate.altEndpoint, models: detectedTemplate.altModels!, dmodel: detectedTemplate.altDmodel!, slots: detectedTemplate.altSlots }
    }
  }
  const [tmplData, setTmplData] = useState<Record<string, TmplEntry | undefined>>(initData)
  const [showKey, setShowKey] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; ms?: number; error?: string; steps?: TestStepInfo[] } | null>(null)
  const [testing, setTesting] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)
  // Key status: when editing, a key is already stored in the provider config.
  // Since keys are stored as plaintext (family-shared ~/.atta/settings.json),
  // we indicate presence without revealing the key value.
  const hasExistingKey = isEdit && !!config

  // Unified fields for BOTH interface types
  const [endpointUrl, setEndpointUrl] = useState(config?.endpointUrl || '')
  const [defaultModel, setDefaultModel] = useState(config?.defaultModel || '')
  const [modelsStr, setModelsStr] = useState(config?.models?.join(', ') || '')
  const [extraParams, setExtraParams] = useState(config?.extraParams ? JSON.stringify(config.extraParams, null, 2) : '')
  const jsonError = useMemo(() => { if (!extraParams.trim()) return null; try { JSON.parse(extraParams); return null } catch { return 'Invalid JSON' } }, [extraParams])

  // Slot model fields (three-tier + options)
  const [opusModel, setOpusModel] = useState(config?.opusModel || '')
  const [sonnetModel, setSonnetModel] = useState(config?.sonnetModel || '')
  const [haikuModel, setHaikuModel] = useState(config?.haikuModel || '')
  const [effortLevel, setEffortLevel] = useState(config?.effortLevel || '')
  const [maxTokens, setMaxTokens] = useState(config?.maxTokens ? String(config.maxTokens) : '')
  const [compactThreshold, setCompactThreshold] = useState(config?.compactThreshold ? String(config.compactThreshold) : '')

  /** Apply template: store BOTH configs keyed by actual interface type, set current interface */
  const applyTemplate = (tid: string) => {
    const t = TEMPLATES.find(t => t.id === tid); if (!t) return
    setTemplateId(tid); setName(t.name)
    const entry = (ep: string, mdls: string, dm: string, sl?: TmplEntry['slots']): TmplEntry => ({ endpoint: ep, models: mdls, dmodel: dm, slots: sl })
    const data: Record<string, TmplEntry | undefined> = {}
    // Map primary interface to its correct type key
    data[t.iface] = entry(t.endpoint, t.models, t.dmodel, t.slots)
    // Map alternate interface if available
    if (t.altEndpoint) {
      const altIface = t.iface === 'anthropic' ? 'openai_compatible' : 'anthropic'
      data[altIface] = entry(t.altEndpoint, t.altModels!, t.altDmodel!, t.altSlots)
    }
    setTmplData(data)
    // Default to Anthropic interface when available (preferred protocol)
    const defaultIface = data.anthropic ? 'anthropic' : t.iface
    setInterfaceType(defaultIface)
    const selected = data[defaultIface]!
    setEndpointUrl(selected.endpoint); setModelsStr(selected.models); setDefaultModel(selected.dmodel)
    applySlots(selected.slots)
  }

  /** Apply slot defaults from template to form fields */
  const applySlots = (s?: TmplEntry['slots']) => {
    setOpusModel(s?.opusModel || '')
    setSonnetModel(s?.sonnetModel || '')
    setHaikuModel(s?.haikuModel || '')
    setEffortLevel(s?.effortLevel || '')
    setMaxTokens(s?.maxTokens ? String(s.maxTokens) : '')
  }

  /** Switch interface: load endpoint/models + slot defaults from template data */
  const handleInterfaceChange = (type: typeof interfaceType) => {
    setInterfaceType(type)
    const d = tmplData[type]
    if (d) { setEndpointUrl(d.endpoint); setModelsStr(d.models); setDefaultModel(d.dmodel); applySlots(d.slots) }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    if (!isEdit && !apiKey.trim()) return
    if (!endpointUrl.trim() || !defaultModel.trim()) return
    if (jsonError) return
    setSaving(true)
    try {
      const mList = modelsStr.split(',').map(m => m.trim()).filter(Boolean)
      let extra: Record<string, unknown> | undefined
      if (extraParams.trim()) extra = JSON.parse(extraParams)
      // Build interfaces map: preserve both interfaces for dual-protocol providers
      const interfaces: Record<string, string> = {}
      if (tmplData.openai_compatible) interfaces.openai_compatible = tmplData.openai_compatible.endpoint
      if (tmplData.anthropic) interfaces.anthropic = tmplData.anthropic.endpoint
      interfaces[interfaceType] = endpointUrl.trim()  // current selection always included
      const slotFields = {
        opusModel: opusModel.trim() || undefined,
        sonnetModel: sonnetModel.trim() || undefined,
        haikuModel: haikuModel.trim() || undefined,
        effortLevel: effortLevel.trim() || undefined,
        maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
        compactThreshold: compactThreshold ? parseInt(compactThreshold, 10) : undefined,
      }
      const payload: CreateModelConfig = {
        name: name.trim(), interfaceType,
        endpointUrl: endpointUrl.trim(), apiKey: apiKey.trim(),
        models: mList, defaultModel: defaultModel.trim(), extraParams: extra,
        interfaces,
        ...slotFields,
      }
      if (isEdit) {
        const patch = { name: payload.name, interfaceType: payload.interfaceType, endpointUrl: payload.endpointUrl, models: payload.models, defaultModel: payload.defaultModel, extraParams: payload.extraParams, interfaces: payload.interfaces, ...slotFields, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) }
        const res = await window.api.model.update(config.id, patch)
        onSaved(res.config || null)
      } else {
        const res = await window.api.model.create(payload)
        onSaved(res.config || null)
      }
    } catch (err) { console.error('[ModelConfigForm] save failed:', err) }
    finally { setSaving(false) }
  }

  const handleTest = async () => {
    let testId = config?.id
    // Add mode: save first to get an ID, then test
    if (!testId) {
      setSaving(true)
      try {
        const mList = modelsStr.split(',').map(m => m.trim()).filter(Boolean)
        const interfaces: Record<string, string> = {}
        if (tmplData.openai_compatible) interfaces.openai_compatible = tmplData.openai_compatible.endpoint
        if (tmplData.anthropic) interfaces.anthropic = tmplData.anthropic.endpoint
        interfaces[interfaceType] = endpointUrl.trim()
        const slots = { opusModel: opusModel.trim() || undefined, sonnetModel: sonnetModel.trim() || undefined, haikuModel: haikuModel.trim() || undefined, effortLevel: effortLevel.trim() || undefined, maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined, compactThreshold: compactThreshold ? parseInt(compactThreshold, 10) : undefined }
        const res = await window.api.model.create({
          name: name.trim(), interfaceType, endpointUrl: endpointUrl.trim(), apiKey: apiKey.trim(),
          models: mList, defaultModel: defaultModel.trim(), extraParams: extraParams.trim() ? JSON.parse(extraParams) : undefined,
          interfaces, ...slots,
        })
        if (!res.config) { setTestResult({ ok: false, error: 'Save failed — cannot test' }); return }
        testId = res.config.id
        // Notify parent of new config WITHOUT closing the form
        onCreated?.(res.config)
      } catch (e: any) { setTestResult({ ok: false, error: e.message || 'Save failed' }); return }
      finally { setSaving(false) }
    }
    setTesting(true); setShowTestModal(true)
    try {
      const res = await window.api.model.test(testId)
      setTestResult({ ok: res.success, ms: res.latencyMs, error: res.error, steps: res.steps })
    } catch (err: any) { setTestResult({ ok: false, error: err.message, steps: [{ step: 1, label: 'IPC Error', status: 'fail', detail: err.message || 'Unknown error' }] }) }
    finally { setTesting(false) }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--app-text)] mb-4">{isEdit ? `Edit "${config.name}"` : 'Add Model'}</h3>
      <div className="space-y-3">
        {/* Template (new only) */}
        {!isEdit && (
          <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Provider Template</label>
            <select value={templateId} onChange={e => applyTemplate(e.target.value)} className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]">
              <option value="">Custom configuration...</option>
              {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {/* Common: Name */}
        <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My DeepSeek" className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]" /></div>

        {/* Common: API Key */}
        <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">API Key {hasExistingKey && <span className="text-[var(--app-text-dim)]">(key saved — leave blank to keep)</span>}{!isEdit && <span className="text-[var(--app-text-dim)]">(required)</span>}</label>
          <div className="relative">
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} type={showKey ? 'text' : 'password'} placeholder={isEdit ? 'Leave blank to keep current key' : 'sk-...'} className="w-full px-3 py-1.5 pr-8 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] font-mono" />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--app-bg-hover)]">{showKey ? <EyeOff className="w-3.5 h-3.5 text-[var(--app-text-dim)]" /> : <Eye className="w-3.5 h-3.5 text-[var(--app-text-dim)]" />}</button>
          </div>
        </div>

        {/* Advanced toggle */}
        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-[11px] text-[var(--app-text-dim)] hover:text-[var(--app-text)]"><ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />Advanced</button>

        {showAdvanced && (
          <div className="space-y-3 pl-2 border-l-2 border-[var(--app-border)]">
            {/* Interface type switch */}
            <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Interface</label>
              <div className="flex gap-2">{(['anthropic','openai_compatible'] as const).map(t => {
                const available = !!tmplData[t]
                const selected = interfaceType === t
                return <button key={t} disabled={!available} onClick={() => handleInterfaceChange(t)}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors
                    ${!available ? 'border-[var(--app-border)] text-[var(--app-text-dim)]/30 cursor-not-allowed'
                    : selected ? 'border-[var(--app-accent)] bg-[var(--app-accent)]/10 text-[var(--app-accent)]'
                    : 'border-[var(--app-border)] text-[var(--app-text-dim)] hover:text-[var(--app-text)]'}`}>
                  {t==='anthropic'?'Anthropic':'OpenAI Compatible'}
                </button>
              })}</div>
            </div>

            {/* Interface-specific fields */}
            <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Endpoint URL</label><input value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)} placeholder="https://api.anthropic.com" className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] font-mono" /></div>
            <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Default Model</label><input value={defaultModel} onChange={e => setDefaultModel(e.target.value)} placeholder="claude-sonnet-4-6" className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]" /></div>
            <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Available Models (comma-separated)</label><input value={modelsStr} onChange={e => setModelsStr(e.target.value)} placeholder="claude-sonnet-4-6, claude-haiku-4-5-20251001, claude-opus-4-8" className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]" /></div>
            <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Extra Params (JSON, optional)</label><textarea value={extraParams} onChange={e => setExtraParams(e.target.value)} rows={2} className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] font-mono resize-none" />{jsonError && <p className="text-[11px] text-red-400 mt-1">{jsonError}</p>}</div>

            {/* Three-tier model slots — Anthropic protocol only */}
            {interfaceType === 'anthropic' && (
            <div className="pt-2 border-t border-[var(--app-border)]">
              <p className="text-[11px] text-[var(--app-text-dim)] mb-2">Model slots — leave empty to fall back to Default Model</p>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Opus (deep think)</label><input value={opusModel} onChange={e => setOpusModel(e.target.value)} placeholder={defaultModel || 'opus model'} className="w-full px-2 py-1 text-[11px] rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]" /></div>
                <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Sonnet (primary)</label><input value={sonnetModel} onChange={e => setSonnetModel(e.target.value)} placeholder={defaultModel || 'sonnet model'} className="w-full px-2 py-1 text-[11px] rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]" /></div>
                <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Haiku (fast)</label><input value={haikuModel} onChange={e => setHaikuModel(e.target.value)} placeholder={defaultModel || 'haiku model'} className="w-full px-2 py-1 text-[11px] rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]" /></div>
              </div>
            </div>
            )}

            {/* Options */}
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Effort Level</label><input value={effortLevel} onChange={e => setEffortLevel(e.target.value)} placeholder="e.g. max" className="w-full px-2 py-1 text-[11px] rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]" /></div>
              <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Max Tokens</label><input value={maxTokens} onChange={e => setMaxTokens(e.target.value.replace(/\D/g, ''))} placeholder="4096" className="w-full px-2 py-1 text-[11px] rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]" /></div>
              <div><label className="text-[11px] text-[var(--app-text-secondary)] block mb-1">Compact Threshold</label><input value={compactThreshold} onChange={e => setCompactThreshold(e.target.value.replace(/\D/g, ''))} placeholder="auto" className="w-full px-2 py-1 text-[11px] rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]" /></div>
            </div>
          </div>
        )}

        {testResult && <div className={`p-2 rounded border text-xs ${testResult.ok ? 'border-green-500/30 bg-green-500/5 text-green-400' : 'border-red-500/30 bg-red-500/5 text-red-400'}`}>{testResult.ok ? `✓ Connected · ${testResult.ms}ms` : `✗ ${testResult.error || 'Connection failed'}`}</div>}
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[var(--app-border)]">
        <button onClick={handleTest} disabled={testing || saving} className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)] disabled:opacity-40">{testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plug className="w-3 h-3" />} Test</button>
        <button onClick={onCancel} className="px-3 py-1 rounded-md text-xs border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)]">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-1 rounded-md text-xs bg-[var(--app-accent)] text-white hover:opacity-90 disabled:opacity-40">{saving ? 'Saving...' : isEdit ? 'Save' : 'Add Model'}</button>
      </div>

      {/* Test result modal */}
      {showTestModal && testResult?.steps && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowTestModal(false)}>
          <div className="bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-xl p-4 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-semibold text-[var(--app-text)]">Connection Test</h3><button onClick={() => setShowTestModal(false)}><X className="w-4 h-4 text-[var(--app-text-dim)]" /></button></div>
            {testing && <div className="flex items-center gap-2 text-xs text-[var(--app-text-dim)]"><Loader2 className="w-3 h-3 animate-spin" />Testing...</div>}
            <div className="space-y-1.5 mt-2">{testResult.steps.map(s => <div key={s.step} className="text-[11px]"><div className="flex items-center gap-2"><span>{s.status==='ok'?<Check className="w-3 h-3 text-green-400"/>:s.status==='fail'?<AlertTriangle className="w-3 h-3 text-red-400"/>:<Loader2 className="w-3 h-3 animate-spin"/>}</span><span className={s.status==='fail'?'text-red-400':'text-[var(--app-text)]'}>{s.label}</span><span className="text-[var(--app-text-dim)] ml-auto">{s.latencyMs ? `${s.latencyMs}ms` : ''}</span></div>{s.status==='fail' && s.detail && <div className="ml-5 mt-0.5 text-[var(--app-text-dim)] break-all">{s.detail}</div>}</div>)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
