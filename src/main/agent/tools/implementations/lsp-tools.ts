/** LSP tool manifests — registered in ToolRegistry for Language Server Protocol operations. */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'allow' as const, requirePreview: false, allowAlways: false }

export const LSP_TOOLS: ToolManifest[] = [
  { id: 'lsp_diagnostic', pluginId: 'builtin', name: 'LSP Diagnostic', description: 'Get code diagnostics for a file via Language Server Protocol', riskLevel: 'read' as const, inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] }, outputSchema, category: 'lsp' as const, permissionPolicy },
  { id: 'lsp_definition', pluginId: 'builtin', name: 'LSP Go to Definition', description: 'Navigate to the definition of a symbol via LSP', riskLevel: 'read' as const, inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } }, required: ['filePath', 'line', 'character'] }, outputSchema, category: 'lsp' as const, permissionPolicy },
  { id: 'lsp_references', pluginId: 'builtin', name: 'LSP Find References', description: 'Find all references to a symbol via LSP', riskLevel: 'read' as const, inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } }, required: ['filePath', 'line', 'character'] }, outputSchema, category: 'lsp' as const, permissionPolicy },
]
