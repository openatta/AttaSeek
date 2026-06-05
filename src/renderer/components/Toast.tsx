/**
 * Toast — simple notification system for transient messages.
 * Used for: IPC errors, permission timeouts, connection status changes.
 */

import { useEffect, useCallback } from 'react'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  action?: { label: string; onClick: () => void }
  duration?: number // ms, default 5000
}

// ── Global toast atom ──
export const toastsAtom = atom<ToastMessage[]>([])

let toastCounter = 0
export function showToast(
  setToasts: (update: (prev: ToastMessage[]) => ToastMessage[]) => void,
  type: ToastType,
  message: string,
  action?: ToastMessage['action'],
  duration?: number,
): void {
  const id = `toast-${++toastCounter}`
  setToasts((prev) => [...prev, { id, type, message, action, duration }])
}

const ICONS: Record<ToastType, typeof AlertTriangle> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertTriangle,
}

const COLORS: Record<ToastType, string> = {
  info: 'border-blue-500/30 bg-blue-500/5',
  success: 'border-green-500/30 bg-green-500/5',
  warning: 'border-yellow-500/30 bg-yellow-500/5',
  error: 'border-red-500/30 bg-red-500/5',
}

export default function ToastContainer() {
  const toasts = useAtomValue(toastsAtom)
  const setToasts = useSetAtom(toastsAtom)

  const dismiss = useCallback(
    (id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    },
    [setToasts],
  )

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const duration = toast.duration || 5000
    const timer = setTimeout(() => onDismiss(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  const Icon = ICONS[toast.type]

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${COLORS[toast.type]} bg-[var(--app-bg-elevated)] shadow-lg animate-in slide-in-from-right`}
    >
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--app-text-secondary)]" />
      <p className="text-xs text-[var(--app-text-secondary)] flex-1">{toast.message}</p>
      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className="text-xs text-[var(--app-accent)] hover:underline flex-shrink-0"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-[var(--app-text-dim)] hover:text-[var(--app-text)]"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
