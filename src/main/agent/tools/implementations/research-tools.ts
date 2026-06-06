/**
 * Research agent tools — manifests for research-specific operations.
 * These are tool manifests (metadata), not implementations.
 * Actual execution logic lives in ToolImplementations or plugin-provided tools.
 */

import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'allow' as const, requirePreview: false, allowAlways: false }

export const RESEARCH_TOOLS: ToolManifest[] = [
  {
    id: 'web_search',
    pluginId: 'builtin',
    name: 'Web Search',
    description: 'Search the web for information on a topic. Returns titles, URLs, and snippets.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
    outputSchema,
    category: 'research',
    permissionPolicy,
  },
  {
    id: 'web_fetch',
    pluginId: 'builtin',
    name: 'Web Fetch',
    description: 'Fetch and extract text content from a URL for analysis.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
    outputSchema,
    category: 'research',
    permissionPolicy,
  },
  {
    id: 'source_verify',
    pluginId: 'builtin',
    name: 'Source Verify',
    description: 'Cross-reference a claim against multiple sources to verify accuracy.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        claim: { type: 'string', description: 'Claim to verify' },
        sources: { type: 'array', items: { type: 'string' }, description: 'Source URLs or titles' },
      },
      required: ['claim'],
    },
    outputSchema,
    category: 'research',
    permissionPolicy,
  },
  {
    id: 'cite_source',
    pluginId: 'builtin',
    name: 'Cite Source',
    description: 'Format a source citation in the specified style (APA, MLA, Chicago, etc.).',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        author: { type: 'string' },
        url: { type: 'string' },
        date: { type: 'string' },
        style: { type: 'string', enum: ['apa', 'mla', 'chicago'] },
      },
      required: ['title'],
    },
    outputSchema,
    category: 'research',
    permissionPolicy,
  },
]
