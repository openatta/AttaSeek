/**
 * Writing agent tools — manifests for document creation and editing.
 */

import type { ToolManifest } from '../../../../shared/types/Tool'

export const WRITING_TOOLS: ToolManifest[] = [
  {
    id: 'create_document',
    name: 'Create Document',
    description: 'Create a new structured document artifact (Markdown, report, article).',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Document content in Markdown' },
        format: { type: 'string', enum: ['markdown', 'html', 'plain'], description: 'Output format' },
      },
      required: ['title', 'content'],
    },
    category: 'writing',
  },
  {
    id: 'review_document',
    name: 'Review Document',
    description: 'Review a document for clarity, tone, grammar, and structure. Returns suggestions.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Document content to review' },
        focus: { type: 'array', items: { type: 'string', enum: ['clarity', 'tone', 'grammar', 'structure', 'brevity'] } },
      },
      required: ['content'],
    },
    category: 'writing',
  },
  {
    id: 'format_document',
    name: 'Format Document',
    description: 'Apply consistent formatting to a document (headings, lists, code blocks, tables).',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        style: { type: 'string', enum: ['markdown', 'academic', 'technical', 'blog'] },
      },
      required: ['content'],
    },
    category: 'writing',
  },
  {
    id: 'outline_document',
    name: 'Outline Document',
    description: 'Generate a structured outline for a document based on a topic and audience.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        audience: { type: 'string' },
        depth: { type: 'number', description: 'Heading depth (1-4)' },
      },
      required: ['topic'],
    },
    category: 'writing',
  },
]
