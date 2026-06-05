/**
 * InlineArtifactPreview — lightweight artifact preview embedded in Conversation.
 *
 * Renders a compact card for ArtifactCreated events inside the message flow.
 * Clicking opens the artifact in ArtifactPane (via activeArtifactAtom).
 */

import { useSetAtom } from 'jotai'
import { activeArtifactAtom, artifactsAtom } from '../../atoms/sessionAtom'
import { outputAreaVisibleAtom, outputTabsAtom, activeOutputTabAtom } from '../../atoms/outputTabsAtom'
import { FileText, Code, Table, Image, ExternalLink } from 'lucide-react'
import type { ArtifactType } from '../../core/types/Artifact'

interface Props {
  artifactId: string
  type: ArtifactType
  title: string
  summary: string
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  markdown: FileText,
  html: Code,
  svg: Image,
  json: Code,
  table: Table,
  chart: Image,
  code: Code,
  diff: Code,
  document: FileText,
}

const TYPE_LABELS: Record<string, string> = {
  markdown: 'Markdown',
  html: 'HTML',
  svg: 'SVG',
  json: 'JSON',
  table: 'Table',
  chart: 'Chart',
  code: 'Code',
  diff: 'Diff',
  document: 'Document',
}

export default function InlineArtifactPreview({ artifactId, type, title, summary }: Props) {
  const setActiveArtifact = useSetAtom(activeArtifactAtom)
  const setOutputVisible = useSetAtom(outputAreaVisibleAtom)
  const setTabs = useSetAtom(outputTabsAtom)
  const setActiveTab = useSetAtom(activeOutputTabAtom)
  const setArtifacts = useSetAtom(artifactsAtom)

  const Icon = TYPE_ICONS[type] || FileText
  const label = TYPE_LABELS[type] || type

  const handleOpen = () => {
    setActiveArtifact(artifactId)
    setOutputVisible(true)
    // Ensure tab exists
    setTabs((prev) => {
      if (prev.find((t) => t.id === artifactId)) return prev
      return [...prev, { id: artifactId, type, label: title }]
    })
    setActiveTab(artifactId)
  }

  return (
    <div className="flex justify-start">
      <button
        onClick={handleOpen}
        className="bg-[var(--app-bg-inset)] border border-[var(--app-border)] hover:border-[var(--app-accent)]/30 rounded-xl px-4 py-3 max-w-[85%] text-left transition-colors group cursor-pointer"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className="w-4 h-4 text-[var(--app-accent)]" />
          <span className="text-xs font-semibold text-[var(--app-text)]">{title}</span>
          <span className="text-[10px] text-[var(--app-text-dim)] px-1.5 py-0.5 rounded bg-[var(--app-bg-active)]">
            {label}
          </span>
          <ExternalLink className="w-3 h-3 text-[var(--app-text-dim)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
        </div>
        <p className="text-xs text-[var(--app-text-secondary)] line-clamp-3 leading-relaxed">
          {summary}
        </p>
        <p className="text-[10px] text-[var(--app-text-dim)] mt-1.5">
          Click to open in Artifact panel →
        </p>
      </button>
    </div>
  )
}
