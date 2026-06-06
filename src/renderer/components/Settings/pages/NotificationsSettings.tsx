import { useState } from 'react'
import { useTranslation } from '../../../i18n'

export default function NotificationsSettings() {
  const [taskComplete, setTaskComplete] = useState(true)
  const [inputNeeded, setInputNeeded] = useState(true)
  const [sound, setSound] = useState(false)
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">{t('notifications.title')}</h2>
      <Toggle label={t('notifications.taskComplete')} desc={t('notifications.taskComplete.desc')} checked={taskComplete} onChange={setTaskComplete} />
      <Toggle label={t('notifications.inputNeeded')} desc={t('notifications.inputNeeded.desc')} checked={inputNeeded} onChange={setInputNeeded} />
      <Toggle label={t('notifications.sound')} desc={t('notifications.sound.desc')} checked={sound} onChange={setSound} />
    </div>
  )
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <div className="flex items-center justify-between py-2 border-b border-[var(--app-border)]"><div><p className="text-xs text-[var(--app-text)]">{label}</p>{desc && <p className="text-[10px] text-[var(--app-text-dim)]">{desc}</p>}</div><button onClick={() => onChange(!checked)} className={`w-9 h-5 rounded-full transition-colors ${checked ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-border)]'} relative`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} /></button></div>
}
