/**
 * DeviceToolbar — Chrome DevTools-level device simulation.
 * Provides device presets, UA switching, viewport customization, rotation.
 */

import { useState } from 'react'
import { RotateCw } from 'lucide-react'

interface DevicePreset {
  name: string
  width: number
  height: number
  userAgent: string
  dpr: number
}

const PRESETS: DevicePreset[] = [
  { name: 'Responsive', width: 0, height: 0, userAgent: '', dpr: 1 },
  { name: 'iPhone 15 Pro', width: 393, height: 852, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', dpr: 3 },
  { name: 'iPhone SE', width: 375, height: 667, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', dpr: 2 },
  { name: 'iPad Pro', width: 1024, height: 1366, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', dpr: 2 },
  { name: 'Pixel 8', width: 412, height: 915, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', dpr: 2.625 },
  { name: 'Galaxy S23', width: 390, height: 844, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S9110)', dpr: 3 },
]

interface DeviceToolbarProps {
  onDeviceChange: (device: DevicePreset) => void
}

export default function DeviceToolbar({ onDeviceChange }: DeviceToolbarProps) {
  const [selectedPreset, setSelectedPreset] = useState('Responsive')
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [dpr, setDpr] = useState(1)
  const [rotated, setRotated] = useState(false)

  const handlePresetChange = (name: string) => {
    setSelectedPreset(name)
    const preset = PRESETS.find((p) => p.name === name)
    if (preset) {
      if (preset.name === 'Responsive') {
        setWidth(0); setHeight(0); setDpr(1)
        onDeviceChange({ ...preset, userAgent: '' })
      } else {
        const w = rotated ? preset.height : preset.width
        const h = rotated ? preset.width : preset.height
        setWidth(w); setHeight(h); setDpr(preset.dpr)
        onDeviceChange(preset)
      }
    }
  }

  const handleRotate = () => {
    setRotated(!rotated)
    setWidth(height)
    setHeight(width)
  }

  return (
    <div className="flex items-center h-[28px] px-2 gap-2 border-b border-[var(--app-border)] flex-shrink-0 bg-[var(--app-bg)] text-xs">
      {/* Device preset select */}
      <select
        value={selectedPreset}
        onChange={(e) => handlePresetChange(e.target.value)}
        className="h-[20px] px-1 text-[11px] bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded text-[var(--app-text-primary)] outline-none"
      >
        {PRESETS.map((p) => (
          <option key={p.name} value={p.name}>{p.name}</option>
        ))}
      </select>

      {/* Viewport dimensions */}
      {selectedPreset !== 'Responsive' && (
        <>
          <span className="text-[var(--app-text-tertiary)]">|</span>
          <input
            type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))}
            className="w-12 h-[20px] px-1 text-[11px] bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded text-[var(--app-text-primary)] outline-none"
          />
          <span className="text-[var(--app-text-tertiary)]">×</span>
          <input
            type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))}
            className="w-12 h-[20px] px-1 text-[11px] bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded text-[var(--app-text-primary)] outline-none"
          />
          <span className="text-[var(--app-text-tertiary)]">|</span>
          <span className="text-[var(--app-text-tertiary)]">DPR:</span>
          <select
            value={dpr} onChange={(e) => setDpr(Number(e.target.value))}
            className="h-[20px] px-1 text-[11px] bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded text-[var(--app-text-primary)] outline-none"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={2.625}>2.625x</option>
          </select>
          <button
            onClick={handleRotate}
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)]"
            title="Rotate"
          >
            <RotateCw className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  )
}
