import { useAtom } from 'jotai'
import { settingsSectionAtom, SETTINGS_SECTIONS } from '../../atoms/settingsAtom'

export default function SettingsSidebar() {
  const [active, setActive] = useAtom(settingsSectionAtom)

  return (
    <div className="flex flex-col gap-0.5 px-3 py-2">
      {SETTINGS_SECTIONS.map((section) => (
        <button
          key={section.id}
          onClick={() => setActive(section.id)}
          className={`text-left px-3 py-1.5 rounded-md text-xs transition-colors
            ${
              active === section.id
                ? 'bg-neutral-800 text-neutral-200'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
            }`}
        >
          {section.label}
        </button>
      ))}
    </div>
  )
}
