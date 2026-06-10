/**
 * TestHookInjector — renders nothing visible but exposes Jotai atom
 * setters on window.__attaTest__ from within the Jotai Provider scope.
 *
 * This is necessary because the app uses <Provider> which scopes the
 * Jotai store. getDefaultStore() outside Provider won't reach
 * components inside it.
 */

import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { apContextAtom, apVisibleAtom, apFullscreenAtom, projectRootAtom } from './ApAtoms'

export default function TestHookInjector(): null {
  const setContext = useSetAtom(apContextAtom)
  const setRoot = useSetAtom(projectRootAtom)
  const setVisible = useSetAtom(apVisibleAtom)
  const setFullscreen = useSetAtom(apFullscreenAtom)

  useEffect(() => {
    ;(window as any).__attaTest__ = {
      setProjectContext(rootPath: string): void {
        setContext('project')
        setRoot(rootPath)
      },
      setChatsContext(): void {
        setContext('chats')
        setRoot(null)
      },
      setApVisible(v: boolean): void {
        setVisible(v)
      },
      setApFullscreen(v: boolean): void {
        setFullscreen(v)
      },
    }
  }, [setContext, setRoot, setVisible, setFullscreen])

  return null
}
