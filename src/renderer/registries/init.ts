/**
 * Registry initialization — registers all built-in activities, sidebar views,
 * artifact renderers, and inline renderers. Called once at startup.
 */

import { registerActivity } from './activityRegistry'
import { registerSidebarView } from './sidebarRegistry'
import { registerArtifactRenderer } from './artifactRendererRegistry'

// Workspace components
import ChatWorkspace from '../workspaces/ChatWorkspace'
import ProjectsWorkspace from '../workspaces/ProjectsWorkspace'
import SettingsWorkspace from '../workspaces/SettingsWorkspace'
import DashboardWorkspace from '../workspaces/DashboardWorkspace'
import SearchWorkspace from '../workspaces/SearchWorkspace'
import AutomationWorkspace from '../workspaces/AutomationWorkspace'
import PluginWorkspace from '../workspaces/PluginWorkspace'

// Sidebar views
import ChatsSidebar from '../workspaces/ChatsSidebar'
import SettingsSidebar from '../components/Settings/SettingsSidebar'
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

// AP Panes
import { registerPane } from '../components/Artifact/PaneRegistry'
import BrowserPane from '../components/Artifact/panes/BrowserPane/BrowserPane'
import TerminalPane from '../components/Artifact/panes/TerminalPane/TerminalPane'
import FilePane from '../components/Artifact/panes/FilePane/FilePane'
import ReviewPane from '../components/Artifact/panes/ReviewPane/ReviewPane'

let initialized = false

export function initializeRegistries(): void {
  if (initialized) return
  initialized = true

  // ── Activities ──────────────────────────────────────────

  registerActivity({ activity: 'home', workspaceComponent: DashboardWorkspace
, defaultArtifactTabs: [] })
  registerActivity({ activity: 'chat', workspaceComponent: ChatWorkspace
, defaultArtifactTabs: [] })
  registerActivity({ activity: 'projects', workspaceComponent: ProjectsWorkspace
, defaultArtifactTabs: ['files', 'review'] })
  registerActivity({ activity: 'search', workspaceComponent: SearchWorkspace
, defaultArtifactTabs: [] })
  registerActivity({ activity: 'automation', workspaceComponent: AutomationWorkspace
, defaultArtifactTabs: [] })
  registerActivity({ activity: 'plugin', workspaceComponent: PluginWorkspace
, defaultArtifactTabs: [] })
  registerActivity({ activity: 'settings', workspaceComponent: SettingsWorkspace
, defaultArtifactTabs: [] })

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

  // ── AP Panes ──────────────────────────────────────────

  registerPane({ type: 'browser',  component: BrowserPane,  label: '浏览器', icon: '🌐', constraints: { singleInstance: true,  requireProject: false } })
  registerPane({ type: 'terminal', component: TerminalPane, label: '终端',   icon: '>_', constraints: { singleInstance: false, requireProject: false } })
  registerPane({ type: 'file',     component: FilePane,     label: '文件',   icon: '📂', constraints: { singleInstance: true, requireProject: true  } })
  registerPane({ type: 'review',   component: ReviewPane,   label: '审查',   icon: '📊', constraints: { singleInstance: true, requireProject: true  } })

  console.log('[registries] initialized — 7 activities, 5 sidebars, 6 renderers, 4 panes')
}

// Auto-init at module load — ensures registries are populated before first render
initializeRegistries()
