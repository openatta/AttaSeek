/**
 * Shared MIME type mapping — single source of truth for both
 * main process (filesystem.ts) and renderer (FilePane, FilePreviewArea).
 *
 * Used to determine file type from extension for display,
 * syntax highlighting, and preview dispatching.
 */

const EXT_TO_MIME: Record<string, string> = {
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.js': 'text/javascript',
  '.jsx': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.py': 'text/x-python',
  '.rs': 'text/x-rust',
  '.toml': 'text/plain',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.xml': 'text/xml',
  '.sh': 'text/x-shellscript',
  '.bash': 'text/x-shellscript',
  '.txt': 'text/plain',
  '.log': 'text/plain',
}

/**
 * Get the MIME type for a file path based on its extension.
 * Returns undefined for unknown extensions.
 */
export function getMimeType(filePath: string): string | undefined {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return EXT_TO_MIME[ext]
}

export { EXT_TO_MIME }
