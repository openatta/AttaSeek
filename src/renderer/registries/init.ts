/**
 * Registry initialization — registers all built-in activities, sidebar views,
 * artifact renderers, and inline renderers. Called once at startup.
 */

import { registerActivity } from './activityRegistry'
import { registerSidebarView } from './sidebarRegistry'
import { registerArtifactRenderer } from './artifactRendererRegistry'

// Sidebar views (no state bridging needed)
import ChatsSidebar from '../workspaces/ChatsSidebar'
import SettingsSidebar from '../components/Settings/SettingsSidebar'

// Sidebar views with atom-connected wrappers
import {
  AutomationSidebarConnected,
  PluginSidebarConnected,
  ProjectsSidebarConnected,
} from '../workspaces/SidebarWrappers'

// Artifact renderers
import MarkdownRenderer from '../renderers/markdown/MarkdownRenderer'
import HtmlRenderer from '../renderers/html/HtmlRenderer'
import SvgRenderer from '../renderers/svg/SvgRenderer'
import TableRenderer from '../renderers/table/TableRenderer'
import CodeRenderer from '../renderers/code/CodeRenderer'
import DiffRenderer from '../renderers/diff/DiffRenderer'

let initialized = false

export function initializeRegistries(): void {
  if (initialized) return
  initialized = true

  // ── Activities ──────────────────────────────────────────

  registerActivity({ activity: 'chat', defaultLayoutMode: 'standard', defaultArtifactTabs: [] })
  registerActivity({ activity: 'projects', defaultLayoutMode: 'standard', defaultArtifactTabs: ['files', 'review'] })
  registerActivity({ activity: 'automation', defaultLayoutMode: 'standard', defaultArtifactTabs: [] })
  registerActivity({ activity: 'plugin', defaultLayoutMode: 'standard', defaultArtifactTabs: [] })
  registerActivity({ activity: 'settings', defaultLayoutMode: 'standard', defaultArtifactTabs: [] })
  registerActivity({ activity: 'home', defaultLayoutMode: 'standard', defaultArtifactTabs: [] })
  registerActivity({ activity: 'search', defaultLayoutMode: 'standard', defaultArtifactTabs: [] })

  // ── Sidebar Views ───────────────────────────────────────

  registerSidebarView({ viewKey: 'chats', activityId: 'chat', component: ChatsSidebar, title: 'Chats' })
  registerSidebarView({ viewKey: 'projects', activityId: 'projects', component: ProjectsSidebarConnected, title: 'Projects' })
  registerSidebarView({ viewKey: 'automation', activityId: 'automation', component: AutomationSidebarConnected, title: 'Automation' })
  registerSidebarView({ viewKey: 'plugin', activityId: 'plugin', component: PluginSidebarConnected, title: 'Plugins' })
  registerSidebarView({ viewKey: 'settings', activityId: 'settings', component: SettingsSidebar, title: 'Settings' })

  // ── Artifact Renderers ──────────────────────────────────

  registerArtifactRenderer({ type: 'markdown', component: MarkdownRenderer, label: 'Markdown' })
  registerArtifactRenderer({ type: 'html', component: HtmlRenderer, label: 'HTML' })
  registerArtifactRenderer({ type: 'svg', component: SvgRenderer, label: 'SVG' })
  registerArtifactRenderer({ type: 'table', component: TableRenderer, label: 'Table' })
  registerArtifactRenderer({ type: 'code', component: CodeRenderer, label: 'Code' })
  registerArtifactRenderer({ type: 'diff', component: DiffRenderer, label: 'Diff' })

  console.log('[registries] initialized — 7 activities, 5 sidebars, 6 renderers')
}
