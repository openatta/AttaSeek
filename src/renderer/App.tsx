import { useEffect, useRef } from 'react'
import { Provider, useSetAtom, useAtomValue } from 'jotai'
import { I18nProvider, useTranslation } from './i18n'
import ThemeProvider from './components/ThemeProvider'
import ErrorBoundary from './components/ErrorBoundary'
import Shell from './layouts/Shell'
import UpdateNotification from './components/UpdateNotification'
import {
  sessionEventsAtom, agentTasksAtom, streamingBuffersAtom,
  sessionTitleStoreAtom, handleAgentEvent, debugLogsAtom,
} from './atoms/sessionAtom'
import { modelConfigsAtom } from './atoms/modelConfigAtom'
import { languageAtom } from './atoms/settingsAtom'
import TestHookInjector from './components/Artifact/TestHookInjector'


/**
 * Persist a session title to the database. Extracted from sessionAtom to keep the
 * atom pure — all side effects live in the hook layer.
 */
function persistSessionTitle(sessionId: string, title: string): void {
  if (typeof window !== 'undefined' && window.api?.session?.update) {
    window.api.session.update(sessionId, { title }).catch((err: unknown) => {
      console.warn('[session] failed to update title:', err)
    })
  }
}

/**
 * Global agent event subscription hook.
 * Sets up the IPC→atom bridge once; useRef guards against double-subscription.
 * Side effects (DB persistence) are isolated here — atoms stay pure.
 */
function useAgentEventBridge() {
  const setSessionEvents = useSetAtom(sessionEventsAtom)
  const setAgentTasks = useSetAtom(agentTasksAtom)
  const setStreamingBuffers = useSetAtom(streamingBuffersAtom)
  const setModelConfigs = useSetAtom(modelConfigsAtom)
  const setDebugLogs = useSetAtom(debugLogsAtom)
  const setTitleStore = useSetAtom(sessionTitleStoreAtom)
  const subscribedRef = useRef(false)
  const messageBufRef = useRef<Map<string, string>>(new Map())

  const handleSessionTitle = (sid: string, title: string) => {
    // Only set title once — prevent follow-up messages from overwriting
    // the original session title.
    setTitleStore((prev) => {
      if (prev[sid] && prev[sid] !== 'New Session') return prev
      return { ...prev, [sid]: title }
    })
  }

  useEffect(() => {
    if (subscribedRef.current) return
    subscribedRef.current = true

    // Subscribe to agent events
    let unsubEvent: (() => void) | undefined
    if (window.api?.agent?.onEvent) {
      unsubEvent = window.api.agent.onEvent((event) => {
        // SessionTitleGenerated: persist title to DB (side effect stays in hook layer)
        if (event.type === 'SessionTitleGenerated' && event.payload.title) {
          persistSessionTitle(event.sessionId, event.payload.title)
        }
        handleAgentEvent(event, {
          setSessionEvents, setAgentTasks, setStreamingBuffers, messageBufRef,
          setSessionTitle: handleSessionTitle,
          addDebugLog: (entry) => setDebugLogs(prev => [...prev.slice(-500), entry]),
        })
      })
    }

    // Load model configs at startup
    if (window.api?.model) {
      window.api.model.list().then((res) => {
        if (res.configs) setModelConfigs(res.configs)
      }).catch((err: unknown) => { console.warn('[App] failed to load model configs:', err) })
    }

    return () => {
      unsubEvent?.()
      subscribedRef.current = false
    }
  }, [setSessionEvents, setAgentTasks, setStreamingBuffers, setModelConfigs])
}

export default function App() {
  return (
    <Provider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </Provider>
  )
}

/**
 * Inner component — needs to be inside Provider to access Jotai atoms.
 */
function LanguageSync() {
  const lang = useAtomValue(languageAtom)
  const { setLocale } = useTranslation()
  useEffect(() => { setLocale((lang === 'zh' ? 'zh' : 'en') as 'en' | 'zh') }, [lang, setLocale])
  return null
}

function AppContent() {
  useAgentEventBridge()
  return (
    <I18nProvider initialLocale="en">
      <LanguageSync />
      <TestHookInjector />
      <ErrorBoundary>
        <Shell />
        <UpdateNotification />
      </ErrorBoundary>
    </I18nProvider>
  )
}
