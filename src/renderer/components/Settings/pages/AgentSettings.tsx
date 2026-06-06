import { useAtom } from 'jotai'
import { personalityAtom, thinkingModeAtom, fastModeAtom, outputStyleAtom, editorModeAtom, instructionsAtom } from '../../../atoms/settingsAtom'
import { useTranslation } from '../../../i18n'

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between py-2 border-b border-[var(--app-border)]"><div><p className="text-xs text-[var(--app-text)]">{label}</p>{desc && <p className="text-[10px] text-[var(--app-text-dim)]">{desc}</p>}</div>{children}</div>
}

export default function AgentSettings() {
  const [personality, setPersonality] = useAtom(personalityAtom); const [thinking, setThinking] = useAtom(thinkingModeAtom)
  const [fastMode, setFastMode] = useAtom(fastModeAtom); const [outputStyle, setOutputStyle] = useAtom(outputStyleAtom)
  const [editorMode, setEditorMode] = useAtom(editorModeAtom); const [instructions, setInstructions] = useAtom(instructionsAtom)
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">{t('agent.title')}</h2>
      <Row label={t('agent.personality')}><select value={personality} onChange={e => setPersonality(e.target.value)} className="w-32 px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)]"><option value="pragmatic">{t('agent.personality.pragmatic')}</option><option value="verbose">{t('agent.personality.verbose')}</option><option value="concise">{t('agent.personality.concise')}</option></select></Row>
      <Row label={t('agent.thinking')} desc={t('agent.thinking.desc')}><select value={thinking} onChange={e => setThinking(e.target.value)} className="w-28 px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)]"><option value="auto">{t('agent.thinking.auto')}</option><option value="enabled">{t('agent.thinking.enabled')}</option><option value="disabled">{t('agent.thinking.disabled')}</option></select></Row>
      <Row label={t('agent.fastMode')}><select value={fastMode} onChange={e => setFastMode(e.target.value)} className="w-24 px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)]"><option value="off">{t('agent.fastMode.off')}</option><option value="on">{t('agent.fastMode.on')}</option><option value="auto">{t('agent.fastMode.auto')}</option></select></Row>
      <Row label={t('agent.outputStyle')}><select value={outputStyle} onChange={e => setOutputStyle(e.target.value)} className="w-28 px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)]"><option value="default">{t('agent.outputStyle.default')}</option><option value="concise">{t('agent.outputStyle.concise')}</option><option value="detailed">{t('agent.outputStyle.detailed')}</option></select></Row>
      <Row label={t('agent.editorMode')}><select value={editorMode} onChange={e => setEditorMode(e.target.value)} className="w-24 px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)]"><option value="normal">{t('agent.editorMode.normal')}</option><option value="vim">{t('agent.editorMode.vim')}</option></select></Row>
      <div className="py-2"><p className="text-xs text-[var(--app-text)] mb-1">{t('agent.instructions')}</p><textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder={t('agent.instructions.placeholder')} rows={3} className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-inset)] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] resize-none" /></div>
    </div>
  )
}
