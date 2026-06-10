/**
 * TerminalPane — xterm.js terminal with node-pty backend.
 * Multi-instance: each AP tab spawns a separate shell process.
 */

import { useAtomValue } from 'jotai'
import { apContextAtom, projectRootAtom } from '../../ApAtoms'
import type { PaneProps } from '../../PaneRegistry'
import { useTerminal } from './useTerminal'
import '@xterm/xterm/css/xterm.css'

export default function TerminalPane(_props: PaneProps) {
  const context = useAtomValue(apContextAtom)
  const projectRoot = useAtomValue(projectRootAtom)

  // Default cwd: home dir in CHATS, project root in project context.
  // Pass undefined for home — the main process resolves os.homedir().
  const cwd = context === 'project' && projectRoot ? projectRoot : undefined

  const { containerRef } = useTerminal({ cwd })

  return (
    <div
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      ref={containerRef as React.RefObject<HTMLDivElement>}
    />
  )
}
