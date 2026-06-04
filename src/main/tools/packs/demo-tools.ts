/**
 * Demo Tool Pack — built-in tools for MVP validation.
 * Registered at startup via ToolRegistry.
 */

import type { ToolManifest } from '../../../renderer/core/types/Tool'

export const DEMO_TOOLS: ToolManifest[] = [
  {
    id: 'read_file',
    pluginId: 'builtin-core',
    name: 'Read File',
    description: 'Read content from a file on the local filesystem',
    inputSchema: { path: 'string' },
    outputSchema: { content: 'string' },
    riskLevel: 'read',
    category: 'filesystem',
    permissionPolicy: { default: 'allow', requirePreview: false, allowAlways: true },
  },
  {
    id: 'search_code',
    pluginId: 'builtin-core',
    name: 'Search Code',
    description: 'Search code in the project directory using grep patterns',
    inputSchema: { pattern: 'string', path: 'string' },
    outputSchema: { matches: 'array' },
    riskLevel: 'read',
    category: 'code',
    permissionPolicy: { default: 'allow', requirePreview: false, allowAlways: true },
  },
  {
    id: 'create_document',
    pluginId: 'builtin-core',
    name: 'Create Document',
    description: 'Create a new document artifact (markdown, etc.)',
    inputSchema: { title: 'string', content: 'string', type: 'string' },
    outputSchema: { artifactId: 'string' },
    riskLevel: 'write',
    category: 'filesystem',
    permissionPolicy: { default: 'ask', requirePreview: true, allowAlways: false },
  },
  {
    id: 'send_email',
    pluginId: 'builtin-core',
    name: 'Send Email',
    description: 'Send an email (mock — generates preview only)',
    inputSchema: { to: 'string', subject: 'string', body: 'string' },
    outputSchema: { preview: 'string' },
    riskLevel: 'risky',
    category: 'communication',
    permissionPolicy: { default: 'ask', requirePreview: true, allowAlways: false },
  },
  {
    id: 'git_commit',
    pluginId: 'builtin-core',
    name: 'Git Commit',
    description: 'Create a git commit (mock — generates diff preview only)',
    inputSchema: { message: 'string', files: 'array' },
    outputSchema: { diff: 'string' },
    riskLevel: 'risky',
    category: 'code',
    permissionPolicy: { default: 'ask', requirePreview: true, allowAlways: false },
  },
]
