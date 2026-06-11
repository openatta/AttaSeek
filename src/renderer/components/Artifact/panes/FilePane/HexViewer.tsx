/**
 * HexViewer — hexadecimal view for binary files.
 *
 * Reads file as base64 via IPC, decodes to Uint8Array, renders
 * in three-column layout: offset | hex values | ASCII.
 */

import { useState, useEffect } from 'react'
import { getApi } from '../../../../utils/api'

const BYTES_PER_ROW = 16
const MAX_HEX_SIZE = 2 * 1024 * 1024 // 2MB limit

interface Props {
  filePath: string
}

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0')
}

function toAscii(byte: number): string {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'
}

export default function HexViewer({ filePath }: Props) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const name = filePath.split('/').pop() || filePath
    const api = getApi()

    api?.fs.readFile(filePath, MAX_HEX_SIZE, 'base64').then((result) => {
      if (cancelled) return
      if (result.success && result.content) {
        try {
          const binary = atob(result.content)
          const arr = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            arr[i] = binary.charCodeAt(i)
          }
          setBytes(arr)
          setError(null)
        } catch {
          setError('Failed to decode file')
        }
      } else {
        setError(result.error || 'Failed to read file')
      }
    }).catch((err: Error) => {
      if (!cancelled) setError(err.message)
    })
    return () => { cancelled = true }
  }, [filePath])

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--app-error)] p-4 text-center">
        {error}
      </div>
    )
  }

  if (!bytes) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--app-text-tertiary)]">
        Loading hex...
      </div>
    )
  }

  const rows: { offset: number; hex: string[]; ascii: string }[] = []
  for (let i = 0; i < bytes.length; i += BYTES_PER_ROW) {
    const chunk = bytes.slice(i, Math.min(i + BYTES_PER_ROW, bytes.length))
    rows.push({
      offset: i,
      hex: Array.from(chunk).map(toHex),
      ascii: Array.from(chunk).map(toAscii).join(''),
    })
  }

  return (
    <div className="h-full overflow-auto bg-[#1e1e1e] font-mono text-xs">
      <div className="p-2">
        {rows.map((row) => (
          <div key={row.offset} className="flex gap-4 leading-5 hover:bg-white/5">
            <span className="text-[var(--app-text-tertiary)] w-[80px] flex-shrink-0 select-none">
              {row.offset.toString(16).padStart(8, '0')}
            </span>
            <span className="flex gap-1">
              {row.hex.map((h, j) => (
                <span
                  key={j}
                  className={j === 7 ? 'mr-2' : ''}
                  style={{ color: h === '00' ? 'var(--app-text-dim)' : 'var(--app-text-primary)' }}
                >
                  {h}
                </span>
              ))}
            </span>
            <span className="text-[var(--app-text-secondary)]">{row.ascii}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
