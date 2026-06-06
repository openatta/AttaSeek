import { useAtom } from 'jotai'
import { permissionModeAtom, sandboxModeAtom, languageAtom } from '../../../atoms/settingsAtom'
import { useTranslation } from '../../../i18n'

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between py-2 border-b border-[var(--app-border)]"><div><p className="text-xs text-[var(--app-text)]">{label}</p>{desc && <p className="text-[10px] text-[var(--app-text-dim)]">{desc}</p>}</div>{children}</div>
}

export default function GeneralSettings() {
  const [permMode, setPermMode] = useAtom(permissionModeAtom)
  const [sandbox, setSandbox] = useAtom(sandboxModeAtom)
  const [language, setLanguage] = useAtom(languageAtom)
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">{t('general.title')}</h2>
      <Row label={t('general.language')}><select value={language} onChange={e => setLanguage(e.target.value)} className="w-28 px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)]"><option value="en">English</option><option value="zh">中文</option></select></Row>
      <Row label={t('general.permissionMode')} desc={t('general.permissionMode.desc')}><select value={permMode} onChange={e => setPermMode(e.target.value)} className="w-44 px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)]"><option value="default">{t('general.permission.default')}</option><option value="auto">{t('general.permission.auto')}</option><option value="trust">{t('general.permission.trust')}</option></select></Row>
      <Row label={t('general.sandbox')} desc={t('general.sandbox.desc')}><select value={sandbox} onChange={e => setSandbox(e.target.value)} className="w-40 px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)]"><option value="read-only">{t('general.sandbox.readonly')}</option><option value="workspace-write">{t('general.sandbox.workspace')}</option><option value="danger-full-access">{t('general.sandbox.full')}</option></select></Row>
    </div>
  )
}
