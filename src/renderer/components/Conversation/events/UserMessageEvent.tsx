import type { UserMessagePayload } from '../../../core/types/SessionEvent'

interface Props {
  payload: UserMessagePayload
}

export default function UserMessageEvent({ payload }: Props) {
  return (
    <div className="flex justify-end">
      <div className="bg-[var(--app-accent)] text-white rounded-xl rounded-br-md px-4 py-2 max-w-[80%]">
        <p className="text-sm">{payload.content}</p>
      </div>
    </div>
  )
}
