import type { TaskCompletedPayload } from '../../../../shared/types/SessionEvent'

interface Props { payload: TaskCompletedPayload }

/** Task completion is handled by the Conversation flow — this renders nothing. */
export default function TaskCompletedEvent(_props: Props) {
  return null
}
