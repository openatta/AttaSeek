import { useEffect, useRef } from 'react'
import { Provider, useSetAtom, useAtomValue } from 'jotai'
import { I18nProvider, useTranslation } from './i18n'
import ThemeProvider from './components/ThemeProvider'
import ErrorBoundary from './components/ErrorBoundary'
import Shell from './layouts/Shell'
import {
  sessionEventsAtom, agentTasksAtom, streamingBuffersAtom,
  _sessionTitleAtom, handleAgentEvent,
} from './atoms/sessionAtom'
import { modelConfigsAtom } from './atoms/modelConfigAtom'
import { languageAtom } from './atoms/settingsAtom'


/**
 * Global agent event subscription hook.
 * Sets up the IPC→atom bridge once; useRef guards against double-subscription.
 */
function useAgentEventBridge() {
  const setSessionEvents = useSetAtom(sessionEventsAtom)
  const setAgentTasks = useSetAtom(agentTasksAtom)
  const setStreamingBuffers = useSetAtom(streamingBuffersAtom)
  const setModelConfigs = useSetAtom(modelConfigsAtom)
  const setTitleStore = useSetAtom(_sessionTitleAtom)
  const subscribedRef = useRef(false)
  const messageBufRef = useRef<Map<string, string>>(new Map())

  const handleSessionTitle = (sid: string, title: string) => {
    setTitleStore((prev) => ({ ...prev, [sid]: title }))
  }

  useEffect(() => {
    if (subscribedRef.current) return
    subscribedRef.current = true

    // Subscribe to agent events
    let unsubEvent: (() => void) | undefined
    if (window.api?.agent?.onEvent) {
      unsubEvent = window.api.agent.onEvent((event) => {
        handleAgentEvent(event, {
          setSessionEvents, setAgentTasks, setStreamingBuffers, messageBufRef,
          setSessionTitle: handleSessionTitle,
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
      <ErrorBoundary>
        <Shell />
      </ErrorBoundary>
    </I18nProvider>
  )
}
