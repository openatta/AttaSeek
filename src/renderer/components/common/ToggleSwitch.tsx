/**
 * ToggleSwitch — reusable on/off toggle component.
 *
 * Renders a pill-shaped toggle with ARIA switch role for accessibility.
 * Supports disabled state. Used by settings pages (Update, General, etc.).
 */

interface Props {
  pressed: boolean
  onChange: (pressed: boolean) => void
  disabled?: boolean
  'aria-label': string
}

export default function ToggleSwitch({ pressed, onChange, disabled, ...props }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={props['aria-label']}
      disabled={disabled}
      onClick={() => onChange(!pressed)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${pressed ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-border)]'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${pressed ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
    </button>
  )
}
