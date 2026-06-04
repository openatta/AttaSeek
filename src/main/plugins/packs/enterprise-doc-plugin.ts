/**
 * Enterprise Document Plugin — demo vertical plugin for MVP validation.
 *
 * Demonstrates the plugin extension model:
 *  - Registers a "Documents" activity
 *  - Contributes document-themed sidebar, skills, tools, and artifact renderers
 *  - Proves the base architecture supports vertical scenario plugins
 */

import type { PluginManifest } from '../../../renderer/core/types/Plugin'

export const EnterpriseDocPlugin: PluginManifest = {
  id: 'enterprise-doc',
  name: 'Enterprise Document Processing',
  version: '0.1.0',
  description: 'Document generation, email drafting, and knowledge base search for enterprise knowledge workers',
  author: 'AttaSeek Team',
  activityEntries: [
    { id: 'documents', label: 'Documents', icon: 'file-text', order: 10 },
  ],
  sidebarViews: [
    {
      activityId: 'documents',
      component: 'DocumentSidebar',
      title: 'Documents',
    },
  ],
  skills: ['generate_doc', 'summarize', 'extract_todos'],
  tools: ['read_file', 'create_document', 'search_code'],
  artifactTypes: ['markdown', 'table', 'code'],
  artifactRenderers: ['markdown', 'table', 'code'],
  settingsPages: ['doc-templates'],
  permissionDefaults: {
    read_file: 'allow',
    create_document: 'ask',
    send_email: 'ask',
    git_commit: 'ask',
  },
}
