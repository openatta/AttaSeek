import { useState, useRef, useEffect } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { modelConfigsAtom, activeModelIdAtom, activeModelNameAtom, hasModelConfiguredAtom } from '../../atoms/modelConfigAtom'
import { ChevronDown, Star } from 'lucide-react'

export default function ModelSelector() {
  const [configs] = useAtom(modelConfigsAtom)
  const [activeModelId, setActiveModelId] = useAtom(activeModelIdAtom)
  const [activeModelName, setActiveModelName] = useAtom(activeModelNameAtom)
  const hasConfigured = useAtomValue(hasModelConfiguredAtom)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!hasConfigured) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red-500/20 text-[11px] text-red-400 select-none">
        No model
      </span>
    )
  }

  // Resolve active provider and model
  const activeConfig = activeModelId
    ? configs.find((c) => c.id === activeModelId)
    : configs.find((c) => c.isDefault) || configs[0]
  const modelName = activeModelName || activeConfig?.defaultModel || activeConfig?.models[0] || 'unknown'
  const label = activeConfig ? `${activeConfig.name} / ${modelName}` : 'Select model'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--app-border)] text-[11px] text-[var(--app-text-secondary)] cursor-pointer hover:border-[var(--app-text-dim)] hover:text-[var(--app-text)] transition-colors select-none"
      >
        {activeConfig?.isDefault && <Star className="w-3 h-3 text-[var(--app-accent)]" />}
        {label}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
          {configs.map((config) => (
            <div key={config.id}>
              {/* Provider header */}
              <div className={`px-3 py-1.5 text-[11px] font-semibold ${activeConfig?.id === config.id ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-secondary)]'}`}>
                {config.isDefault && <Star className="w-3 h-3 text-[var(--app-accent)] inline mr-1" />}
                {config.name}
                <span className="text-[10px] text-[var(--app-text-dim)] ml-1">
                  ({config.interfaceType === 'anthropic' ? 'Anthropic' : 'OpenAI Compat'})
                </span>
              </div>
              {/* Model list */}
              {config.models.map((model) => {
                const isActive = activeConfig?.id === config.id && modelName === model
                return (
                  <button
                    key={model}
                    onClick={() => {
                      setActiveModelId(config.id)
                      setActiveModelName(model)
                      setOpen(false)
                    }}
                    className={`w-full text-left pl-8 pr-3 py-1 text-[11px] transition-colors ${
                      isActive
                        ? 'bg-[var(--app-accent)]/10 text-[var(--app-text)]'
                        : 'text-[var(--app-text-dim)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)]'
                    }`}
                  >
                    {model === config.defaultModel && '◆ '}
                    {model}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
