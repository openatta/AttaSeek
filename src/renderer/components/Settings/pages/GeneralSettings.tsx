import { useAtom } from 'jotai'
import { permissionModeAtom, sandboxModeAtom, languageAtom, minimizeToTrayAtom, autoLaunchAtom, startMinimizedAtom } from '../../../atoms/settingsAtom'
import { useTranslation } from '../../../i18n'
import ToggleSwitch from '../../common/ToggleSwitch'

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between py-2 border-b border-[var(--app-border)]"><div><p className="text-xs text-[var(--app-text)]">{label}</p>{desc && <p className="text-[10px] text-[var(--app-text-dim)]">{desc}</p>}</div>{children}</div>
}

export default function GeneralSettings() {
  const [permMode, setPermMode] = useAtom(permissionModeAtom)
  const [sandbox, setSandbox] = useAtom(sandboxModeAtom)
  const [language, setLanguage] = useAtom(languageAtom)
  const [minimizeToTray, setMinimizeToTray] = useAtom(minimizeToTrayAtom)
  const [autoLaunch, setAutoLaunch] = useAtom(autoLaunchAtom)
  const [startMinimized, setStartMinimized] = useAtom(startMinimizedAtom)
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">{t('general.title')}</h2>
      <Row label={t('general.language')}><select value={language} onChange={e => setLanguage(e.target.value)} className="w-28 px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)]"><option value="en">English</option><option value="zh">中文</option></select></Row>
      <Row label={t('general.permissionMode')} desc={t('general.permissionMode.desc')}><select value={permMode} onChange={e => setPermMode(e.target.value)} className="w-44 px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)]"><option value="default">{t('general.permission.default')}</option><option value="auto">{t('general.permission.auto')}</option><option value="trust">{t('general.permission.trust')}</option></select></Row>
      <Row label={t('general.sandbox')} desc={t('general.sandbox.desc')}><select value={sandbox} onChange={e => setSandbox(e.target.value)} className="w-40 px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)]"><option value="read-only">{t('general.sandbox.readonly')}</option><option value="workspace-write">{t('general.sandbox.workspace')}</option><option value="danger-full-access">{t('general.sandbox.full')}</option></select></Row>

      {/* Tray settings */}
      <h2 className="text-sm font-semibold text-[var(--app-text)] pt-2">{t('general.traySection', '系统托盘')}</h2>
      <Row label={t('general.minimizeToTray', '关闭窗口时最小化到托盘')} desc={t('general.minimizeToTray.desc', '点击关闭按钮时隐藏窗口到系统托盘，应用继续在后台运行')}>
        <ToggleSwitch pressed={minimizeToTray} onChange={setMinimizeToTray} aria-label={t('general.minimizeToTray', '关闭窗口时最小化到托盘')} />
      </Row>
      <Row label={t('general.autoLaunch', '开机自动启动')} desc={t('general.autoLaunch.desc', '登录系统时自动启动 AttaSeek')}>
        <ToggleSwitch pressed={autoLaunch} onChange={setAutoLaunch} aria-label={t('general.autoLaunch', '开机自动启动')} />
      </Row>
      <Row label={t('general.startMinimized', '启动时最小化到托盘')} desc={autoLaunch ? t('general.startMinimized.desc', '开机启动时不弹出主窗口，直接最小化到托盘') : t('general.startMinimized.disabledDesc', '需先开启"开机自动启动"')}>
        <ToggleSwitch pressed={startMinimized} onChange={setStartMinimized} disabled={!autoLaunch} aria-label={t('general.startMinimized', '启动时最小化到托盘')} />
      </Row>
    </div>
  )
}
