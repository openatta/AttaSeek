export {
  registerActivity,
  getActivityConfig,
  listActivities,
  listBuiltInActivities,
  unregisterByPlugin as unregisterActivityByPlugin,
} from './activityRegistry'
export type { ActivityRegistration, LayoutMode } from './activityRegistry'

export {
  registerSidebarView,
  getSidebarView,
  getPrimarySidebarView,
  listSidebarViews,
  unregisterByPlugin as unregisterSidebarByPlugin,
} from './sidebarRegistry'
export type { SidebarViewRegistration } from './sidebarRegistry'

export {
  registerArtifactRenderer,
  getRenderer,
  listRenderers,
  unregisterByPlugin as unregisterArtifactRendererByPlugin,
} from './artifactRendererRegistry'
export type { ArtifactRendererRegistration, ArtifactRendererProps } from './artifactRendererRegistry'

export {
  registerInlineRenderer,
  getInlineRenderer,
  listInlineRenderers,
  unregisterByPlugin as unregisterInlineRendererByPlugin,
} from './inlineRendererRegistry'
export type { InlineRendererRegistration, InlineRendererProps } from './inlineRendererRegistry'
