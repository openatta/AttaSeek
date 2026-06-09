import { useAtom } from 'jotai'
import { debugLogsAtom } from '../../atoms/sessionAtom'

interface Props { onClose: () => void }

export default function LogViewer({ onClose }: Props) {
  const [logs, setLogs] = useAtom(debugLogsAtom)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-xl shadow-2xl w-[800px] max-h-[600px] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--app-border)]">
          <h2 className="text-sm font-semibold text-[var(--app-text)]">Debug Logs</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setLogs([])} className="px-2 py-1 text-xs rounded bg-[var(--app-bg-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)]">Clear</button>
            <button onClick={onClose} className="text-[var(--app-text-dim)] hover:text-[var(--app-text)]">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <p className="text-[var(--app-text-dim)]">No logs captured yet.</p>
          ) : (
            logs.map((entry, i) => (
              <div key={i} className="py-0.5">
                <span className="text-[var(--app-text-dim)]">{entry.time}</span>{' '}
                <span className={entry.level === 'error' ? 'text-red-400' : entry.level === 'warn' ? 'text-yellow-400' : 'text-[var(--app-text-secondary)]'}>
                  [{entry.level}] {entry.msg}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
