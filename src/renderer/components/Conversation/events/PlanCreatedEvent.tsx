import type { PlanCreatedPayload } from '../../../core/types/SessionEvent'

interface Props {
  payload: PlanCreatedPayload
}

export default function PlanCreatedEvent({ payload }: Props) {
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--app-bg-inset)] border border-[var(--app-accent-border)] rounded-xl px-4 py-3 max-w-[85%]">
        <p className="text-xs font-semibold text-[var(--app-accent)] mb-2">📋 Plan</p>
        <p className="text-[11px] text-[var(--app-text-dim)] mb-2">{payload.plan.reasoning}</p>
        {payload.plan.steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2 text-xs py-0.5">
            <span
              className={
                step.status === 'completed'
                  ? 'text-green-400'
                  : step.status === 'active'
                    ? 'text-[var(--app-accent)]'
                    : 'text-[var(--app-text-dim)]'
              }
            >
              {step.status === 'completed' ? '✓' : step.status === 'active' ? '●' : '○'}
            </span>
            <span className="text-[var(--app-text-secondary)]">{step.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
