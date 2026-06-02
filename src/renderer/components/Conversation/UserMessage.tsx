interface UserMessageProps {
  content: string
}

export default function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="flex justify-end px-4 py-2">
      <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-neutral-800 text-sm text-neutral-200">
        {content}
      </div>
    </div>
  )
}
