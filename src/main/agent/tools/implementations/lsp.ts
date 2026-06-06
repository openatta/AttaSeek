/** LSP tools — lsp_diagnostic, lsp_definition, lsp_references (stubs, require LSP server config) */
export const lspDiagnosticImpl = {
  toolId: 'lsp_diagnostic',
  execute: async (input: Record<string, unknown>) => {
    const filePath = String(input.filePath || '')
    if (!filePath) throw new Error('filePath is required')
    return `[LSP diagnostic not available: no language server configured for ${filePath}. Configure an LSP server in Settings to enable real-time diagnostics.]`
  },
}

export const lspDefinitionImpl = {
  toolId: 'lsp_definition',
  execute: async (input: Record<string, unknown>) => {
    const filePath = String(input.filePath || ''); const line = Number(input.line || 1); const character = Number(input.character || 1)
    return `[LSP go-to-definition not available: no language server configured. Would navigate to definition at ${filePath}:${line}:${character}.]`
  },
}

export const lspReferencesImpl = {
  toolId: 'lsp_references',
  execute: async (input: Record<string, unknown>) => {
    const filePath = String(input.filePath || ''); const line = Number(input.line || 1); const character = Number(input.character || 1)
    return `[LSP find-references not available: no language server configured. Would find references for symbol at ${filePath}:${line}:${character}.]`
  },
}
