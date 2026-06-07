/**
 * UserQuestionEvent — renders a question the agent is asking the user.
 * User can type a free-text answer or select from predefined options.
 */

import { useState } from 'react'
import type { UserQuestionPayload } from '../../../../shared/types/SessionEvent'

interface Props {
  payload: UserQuestionPayload
}

export function UserQuestionEvent({ payload }: Props): JSX.Element {
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const respond = (value: string) => {
    setSubmitted(true)
    window.api.question.respond(payload.questionId, value).catch((err) => {
      console.warn('[UserQuestion] respond failed:', err)
      setSubmitted(false)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && answer.trim()) {
      respond(answer.trim())
    }
  }

  return (
    <div className="my-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
      <div className="text-sm font-medium text-blue-400 mb-2">🤔 Agent asks:</div>
      <div className="text-sm text-gray-200 mb-3 whitespace-pre-wrap">{payload.question}</div>

      {payload.options && payload.options.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {payload.options.map((opt) => (
            <button
              key={opt}
              disabled={submitted}
              onClick={() => respond(opt)}
              className="px-3 py-1 text-xs rounded border border-blue-500/50 text-blue-300 hover:bg-blue-500/20 disabled:opacity-40"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {submitted ? (
        <div className="text-xs text-gray-500 italic">Answer submitted: {answer || '(selected)'}</div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            className="flex-1 px-2 py-1 text-xs rounded border border-gray-600 bg-gray-800 text-gray-200 focus:outline-none focus:border-blue-500"
          />
          <button
            disabled={!answer.trim()}
            onClick={() => respond(answer.trim())}
            className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      )}
    </div>
  )
}
