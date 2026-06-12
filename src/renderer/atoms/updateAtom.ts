/**
 * Update state atoms — mirror UpdateManager state in the renderer process.
 * Updated via IPC push events (update:event) and direct queries.
 */

import { atom } from 'jotai'
import type { UpdateState, UpdateStatus, UpdateManifest, UpdateProgress, UpdateEvent } from '../../shared/types/update'

/** Current update status (synced from main process via IPC). */
export const updateStatusAtom = atom<UpdateStatus>({
  state: 'idle',
  canRetry: false,
  retryCount: 0,
})

/** Whether the update notification is visible (user may dismiss it). */
export const updateNotificationVisibleAtom = atom<boolean>(true)

/** Track the last seen event type for notification display logic. */
export const lastUpdateEventAtom = atom<UpdateEvent | null>(null)
