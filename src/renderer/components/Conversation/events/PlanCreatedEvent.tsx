import type { PlanCreatedPayload } from '../../../../shared/types/SessionEvent'

interface Props { payload: PlanCreatedPayload }

export default function PlanCreatedEvent({ payload }: Props) {
  return (
    <div className="py-3">
      <div className="text-xs font-semibold text-[var(--app-text)] mb-2">Plan</div>
      <div className="bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded-lg p-3">
        {payload.plan.reasoning && (
          <p className="text-xs text-[var(--app-text-dim)] mb-2 italic">{payload.plan.reasoning}</p>
        )}
        {payload.plan.steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2 text-xs py-0.5">
            <span>{step.status === 'completed' ? '✓' : step.status === 'active' ? '●' : '○'}</span>
            <span className={step.status === 'completed' ? 'line-through text-[var(--app-text-dim)]' : 'text-[var(--app-text-secondary)]'}>
              {step.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
