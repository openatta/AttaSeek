/**
 * Demo Tool Pack — built-in tools for MVP validation.
 * Registered at startup via ToolRegistry.
 * Input schemas use standard JSON Schema format (required by Anthropic/OpenAI APIs).
 */

import type { ToolManifest } from '../../../shared/types/Tool'

export const DEMO_TOOLS: ToolManifest[] = [
  {
    id: 'read_file',
    pluginId: 'builtin-core',
    name: 'Read File',
    description: 'Read content from a file on the local filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative path to the file to read' },
      },
      required: ['path'],
    },
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
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'The search pattern or regex to match' },
        path: { type: 'string', description: 'Directory path to search in (default: project root)' },
      },
      required: ['pattern'],
    },
    outputSchema: { matches: 'array' },
    riskLevel: 'read',
    category: 'code',
    permissionPolicy: { default: 'allow', requirePreview: false, allowAlways: true },
  },
  {
    id: 'create_document',
    pluginId: 'builtin-core',
    name: 'Create Document',
    description: 'Create a new document artifact (markdown, HTML, code, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the document' },
        content: { type: 'string', description: 'Full content of the document' },
        type: { type: 'string', description: 'Document type: markdown, html, code, json, or table' },
      },
      required: ['title', 'content'],
    },
    outputSchema: { artifactId: 'string' },
    riskLevel: 'write',
    category: 'filesystem',
    permissionPolicy: { default: 'ask', requirePreview: true, allowAlways: false },
  },
  {
    id: 'send_email',
    pluginId: 'builtin-core',
    name: 'Send Email',
    description: 'Send an email (mock — generates preview only, no actual email sent)',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body content' },
      },
      required: ['to', 'subject', 'body'],
    },
    outputSchema: { preview: 'string' },
    riskLevel: 'risky',
    category: 'communication',
    permissionPolicy: { default: 'ask', requirePreview: true, allowAlways: false },
  },
  {
    id: 'git_commit',
    pluginId: 'builtin-core',
    name: 'Git Commit',
    description: 'Create a git commit (mock — generates diff preview only, no actual commit)',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Commit message' },
        files: { type: 'array', description: 'List of files to include in the commit' },
      },
      required: ['message'],
    },
    outputSchema: { diff: 'string' },
    riskLevel: 'risky',
    category: 'code',
    permissionPolicy: { default: 'ask', requirePreview: true, allowAlways: false },
  },
]
