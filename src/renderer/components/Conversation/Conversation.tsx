import SessionHeader from './SessionHeader'
import MessageFlow from './MessageFlow'
import Composer from './Composer'

export default function Conversation() {
  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">
      <SessionHeader />
      <MessageFlow />
      <Composer />
    </div>
  )
}
