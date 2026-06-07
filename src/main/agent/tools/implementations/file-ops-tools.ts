/** File operation tool manifests — write_file, edit_file, glob, grep. */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const writePolicy = { default: 'ask' as const, requirePreview: true, allowAlways: false }
const readPolicy = { default: 'allow' as const, requirePreview: false, allowAlways: false }

export const FILE_OPS_TOOLS: ToolManifest[] = [
  {
    id: 'write_file',
    pluginId: 'builtin',
    name: 'Write File',
    description: 'Write content to a file (atomic: temp file + rename). Creates parent directories as needed.',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write to' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path'],
    },
    outputSchema,
    category: 'filesystem',
    permissionPolicy: writePolicy,
  },
  {
    id: 'edit_file',
    pluginId: 'builtin',
    name: 'Edit File',
    description: 'Replace all occurrences of old_string with new_string in a file. Fails if old_string is not found.',
    riskLevel: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to edit' },
        old_string: { type: 'string', description: 'Exact text to find and replace' },
        new_string: { type: 'string', description: 'Replacement text' },
      },
      required: ['path', 'old_string'],
    },
    outputSchema,
    category: 'filesystem',
    permissionPolicy: writePolicy,
  },
  {
    id: 'glob',
    pluginId: 'builtin',
    name: 'Glob',
    description: 'Find files matching a glob pattern. Skips hidden dirs and node_modules. Max 500 results.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g., **/*.ts)' },
        cwd: { type: 'string', description: 'Search root (default: project root)' },
      },
      required: ['pattern'],
    },
    outputSchema,
    category: 'filesystem',
    permissionPolicy: readPolicy,
  },
  {
    id: 'grep',
    pluginId: 'builtin',
    name: 'Grep',
    description: 'Search file contents for a pattern. Returns file:line:content matches. Max 1000 results.',
    riskLevel: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Text or regex pattern to search for' },
        cwd: { type: 'string', description: 'Search root (default: project root)' },
      },
      required: ['pattern'],
    },
    outputSchema,
    category: 'filesystem',
    permissionPolicy: readPolicy,
  },
]
