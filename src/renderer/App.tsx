import { useEffect, useRef } from 'react'
import { Provider, useSetAtom } from 'jotai'
import ThemeProvider from './components/ThemeProvider'
import Shell from './layouts/Shell'
import { sessionEventsAtom, agentTasksAtom, handleAgentEvent } from './atoms/sessionAtom'
import type { SessionEvent } from './core/types/SessionEvent'

/**
 * Global agent event subscription hook.
 * Sets up the IPC→atom bridge once; useRef guards against double-subscription.
 */
function useAgentEventBridge() {
  const setSessionEvents = useSetAtom(sessionEventsAtom)
  const setAgentTasks = useSetAtom(agentTasksAtom)
  const subscribedRef = useRef(false)

  useEffect(() => {
    if (subscribedRef.current) return
    if (!window.api?.agent?.onEvent) return

    subscribedRef.current = true
    const unsubscribe = window.api.agent.onEvent((event: unknown) => {
      handleAgentEvent(event as SessionEvent, setSessionEvents, setAgentTasks)
    })

    return () => {
      unsubscribe?.()
      subscribedRef.current = false
    }
  }, [setSessionEvents, setAgentTasks])
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
function AppContent() {
  useAgentEventBridge()
  return <Shell />
}
