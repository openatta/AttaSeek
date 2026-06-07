/** Document/writing tool manifests — review_document, format_document, outline_document. */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'allow' as const, requirePreview: false, allowAlways: false }

export const WRITING_TOOLS: ToolManifest[] = [
  {
    id: 'review_document',
    pluginId: 'builtin',
    name: 'Review Document',
    description: 'Review a document for clarity, tone, grammar, and structure. Returns statistical pre-check + recommendations.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Document content to review' },
        focus: { type: 'array', items: { type: 'string' }, description: 'Review focus areas: clarity, tone, grammar, structure, brevity' },
      },
      required: ['content'],
    },
    outputSchema,
    category: 'code',
    permissionPolicy,
  },
  {
    id: 'format_document',
    pluginId: 'builtin',
    name: 'Format Document',
    description: 'Format document text: normalize line endings, trim trailing whitespace, collapse blank lines, apply markdown styling.',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Text content to format' },
        style: { type: 'string', enum: ['markdown', 'plain'], description: 'Target format style' },
      },
      required: ['content'],
    },
    outputSchema,
    category: 'code',
    permissionPolicy,
  },
  {
    id: 'outline_document',
    pluginId: 'builtin',
    name: 'Outline Document',
    description: 'Generate a structured document outline for a given topic with configurable depth and audience.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Document topic' },
        audience: { type: 'string', description: 'Target audience (default: general)' },
        depth: { type: 'number', description: 'Outline depth 1-4 (default: 3)' },
      },
      required: ['topic'],
    },
    outputSchema,
    category: 'code',
    permissionPolicy,
  },
]
