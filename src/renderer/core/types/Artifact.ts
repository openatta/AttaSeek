/**
 * Artifact — agent output that becomes an editable, versioned product.
 * Managed by ArtifactService in main process; rendered by ArtifactPane in renderer.
 */

export type ArtifactType =
  | 'markdown'
  | 'html'
  | 'svg'
  | 'json'
  | 'table'
  | 'chart'
  | 'code'
  | 'diff'
  | 'document'
  | 'form'
  | 'dashboard'
  | 'research_report'
  | 'trade_plan'
  | 'risk_check'
  | 'email_draft'
  | 'task_list'
  | 'journal_entry'
  | 'review_report'
  | 'files'
  | 'terminal'
  | 'browser'
  | 'plugin-custom'

export interface Artifact {
  id: string
  sessionId: string
  taskId: string
  type: ArtifactType
  title: string
  content: string
  contentRef?: string
  rendererHint?: string
  version: number
  editable: boolean
  permissions?: ArtifactPermissions
  createdAt: number
  updatedAt: number
}

export interface ArtifactPermissions {
  allowEdit: boolean
  allowExport: boolean
  allowDelete: boolean
}

export interface ArtifactSummary {
  id: string
  type: ArtifactType
  title: string
  version: number
  updatedAt: number
}

/** Minimum MVP renderer type hints */
export type ArtifactRendererHint =
  | 'markdown'
  | 'html'
  | 'svg'
  | 'json'
  | 'table'
  | 'chart'
  | 'code'
  | 'diff'
  | 'document'
  | 'dashboard'
  | 'files'
  | 'terminal'
  | 'browser'
  | 'plugin-custom'
