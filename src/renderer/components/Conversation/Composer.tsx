import { useState, useEffect, useRef } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  composerValueAtom,
  composerChipsAtom,
  isAgentRunningAtom,
  editTextAtom,
} from '../../atoms/composerAtom'
import {
  permissionModeAtom, reasoningEffortAtom,
  type PermissionMode, type ReasoningEffort,
} from '../../atoms/settingsAtom'
import { currentSessionIdAtom, agentTasksAtom, sessionEventsAtom, selectedProjectIdAtom } from '../../atoms/sessionAtom'
import { activeActivityAtom } from '../../atoms/activityAtom'
import { activeModelIdAtom, activeModelNameAtom, hasModelConfiguredAtom } from '../../atoms/modelConfigAtom'
import type { AgentTask } from '../../core/types/AgentTask'
import type { SessionEvent } from '../../core/types/SessionEvent'
import ContextChip from './ContextChip'
import ModelSelector from './ModelSelector'
import { Plus, Mic, ArrowUp } from 'lucide-react'

const PERMISSION_LABELS: Record<PermissionMode, string> = {
  default: 'Default Review',
  auto: 'Auto Review',
  trust: 'Full Trust'
}

const REASONING_LABELS: Record<ReasoningEffort, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
}

export default function Composer() {
  const [value, setValue] = useAtom(composerValueAtom)
  const [chips, setChips] = useAtom(composerChipsAtom)
  const [isRunning, setIsRunning] = useAtom(isAgentRunningAtom)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [permissionMode, setPermissionMode] = useAtom(permissionModeAtom)
  const [reasoningEffort, setReasoningEffort] = useAtom(reasoningEffortAtom)
  const sessionId = useAtomValue(currentSessionIdAtom)
  const setTasks = useSetAtom(agentTasksAtom)
  const setSessionEvents = useSetAtom(sessionEventsAtom)
  const activeModelId = useAtomValue(activeModelIdAtom)
  const activeModelName = useAtomValue(activeModelNameAtom)
  const hasModelConfigured = useAtomValue(hasModelConfiguredAtom)
  const selectedProjectId = useAtomValue(selectedProjectIdAtom)
  const activeActivity = useAtomValue(activeActivityAtom)

  const projectInputDisabled = activeActivity === 'projects' && !selectedProjectId
  const tasks = useAtomValue(agentTasksAtom)

  // Auto-update isRunning: detect when all tasks complete/fail/cancel
  useEffect(() => {
    const sessionTasks = tasks.filter((t) => t.sessionId === sessionId)
    const hasActive = sessionTasks.some((t) => !['completed', 'failed', 'cancelled', 'denied'].includes(t.status))
    if (!hasActive && currentTaskId) {
      setIsRunning(false)
      setCurrentTaskId(null)
    }
  }, [tasks, sessionId])

  const removeChip = (id: string) => setChips((prev) => prev.filter((c) => c.id !== id))
  const [editText, setEditText] = useAtom(editTextAtom)
  useEffect(() => { if (editText !== null) { setValue(editText); setEditText(null) } }, [editText])

  const cyclePermission = () => {
    const modes: PermissionMode[] = ['default', 'auto', 'trust']
    const idx = modes.indexOf(permissionMode)
    setPermissionMode(modes[(idx + 1) % modes.length])
  }

  const cycleReasoning = () => {
    const efforts: ReasoningEffort[] = ['low', 'medium', 'high']
    const idx = efforts.indexOf(reasoningEffort)
    setReasoningEffort(efforts[(idx + 1) % efforts.length])
  }

  const handleSend = async () => {
    const trimmed = value.trim()
    if (!trimmed || isRunning) return

    // No model configured — inject system notification into event stream
    if (!hasModelConfigured) {
      const promptEvent: SessionEvent = {
        id: `evt_nomodel_${Date.now()}`,
        sessionId,
        taskId: '',
        type: 'SystemNotification',
        payload: { kind: 'no_model', message: 'No model configured — open Settings to add one' },
        createdAt: Date.now(),
      }
      setSessionEvents((prev) => [...prev, promptEvent])
      return
    }

    setValue('')
    setIsRunning(true)

    try {
      if (window.api?.agent?.createTask) {
        const result = await window.api.agent.createTask(trimmed, sessionId, selectedProjectId || undefined, activeModelId || undefined, activeModelName || undefined)
        if (result.success && result.task) {
          const task = result.task as AgentTask
          setCurrentTaskId(task.id)
          setTasks((prev: AgentTask[]) => [...prev, task])
        } else {
          // Task creation failed — reset immediately
          setIsRunning(false)
        }
      }
    } catch (err) {
      console.error('[Composer] send error:', err)
      setIsRunning(false)
    }
    // Note: setIsRunning(false) is NOT here — isRunning resolves via agentTasksAtom status change
  }

  const handleStop = async () => {
    if (!currentTaskId) return
    try {
      await window.api.agent.cancelTask(currentTaskId)
      setCurrentTaskId(null)
    } catch (err) { console.error('[Composer] stop error:', err) }
    finally { setIsRunning(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-shrink-0 pt-2 pb-3 bg-[var(--app-bg)]">
      <div className="max-w-[48rem] mx-auto px-4">
      {/* Context chips — above the input card */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {chips.map((chip) => (
            <ContextChip key={chip.id} chip={chip} onRemove={() => removeChip(chip.id)} />
          ))}
        </div>
      )}

      {/* Project hint — shown when in Projects activity but no project selected */}
      {projectInputDisabled ? (
        <div className="flex-1 flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <p className="text-sm text-[var(--app-text-secondary)] mb-1">Select a project to start</p>
            <p className="text-xs text-[var(--app-text-dim)]">Choose a project from the sidebar or create a new one</p>
          </div>
        </div>
      ) : (
        <>
      {/* Input card — CODEX style: textarea + toolbar together in a bordered box */}
      <div className="bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded-xl focus-within:border-[var(--app-accent)] focus-within:ring-1 focus-within:ring-[var(--app-accent-border)] transition-colors">
        {/* Textarea */}
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-dim)] resize-none outline-none border-none ring-0 focus:ring-0 px-3 pt-2.5"
          placeholder="Ask anything…"
          rows={Math.min(10, Math.max(3, value.split('\n').length))}
        />

        {/* Toolbar row — inside the card, at the bottom */}
        <div className="flex items-center gap-0.5 px-2 pb-2">
          {/* + Add context */}
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
            title="Add context"
            aria-label="Add context"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Mic button */}
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
            title="Voice input"
            aria-label="Voice input"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Send / Stop — same button position, toggles function */}
          {isRunning ? (
            <button
              onClick={handleStop}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-[var(--app-accent)] text-white hover:opacity-90 transition-colors animate-pulse"
              title="Stop generating"
              aria-label="Stop"
            >
              <span className="text-[13px] leading-none">■</span>
            </button>
          ) : (
            <button
              onClick={handleSend}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors
                ${value.trim()
                  ? 'bg-[var(--app-text)] text-[var(--app-bg)] hover:opacity-90'
                  : 'bg-[var(--app-bg-active)] text-[var(--app-text-dim)] cursor-not-allowed'
                }`}
              disabled={!value.trim()}
              title="Send"
              aria-label="Send"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metadata row — below the input card: permission / reasoning / model */}
      <div className="flex items-center gap-1.5 mt-1.5 px-1">
        <button
          onClick={cyclePermission}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[var(--app-text-secondary)] cursor-pointer hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors select-none"
        >
          {PERMISSION_LABELS[permissionMode]}
        </button>

        <button
          onClick={cycleReasoning}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[var(--app-text-dim)] cursor-pointer hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors select-none"
        >
          Reasoning ▾
        </button>

        <div className="flex-1" />

        <ModelSelector />

        <span className="text-[10px] text-[var(--app-text-dim)] hidden sm:inline ml-1">⌘⏎</span>
      </div>
      </>
      )}
      </div> {/* close max-w-[48rem] mx-auto */}
    </div>
  )
}
