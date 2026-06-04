import SessionHeader from './SessionHeader'
import MessageFlow from './MessageFlow'
import Composer from './Composer'

export default function Conversation() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <SessionHeader />
      <MessageFlow />
      <Composer />
    </div>
  )
}
