/**
 * Shared MIME type mapping — single source of truth for both
 * main process (filesystem.ts) and renderer (FilePane, FilePreviewArea).
 *
 * Used to determine file type from extension for display,
 * syntax highlighting, and preview dispatching.
 *
 * ⚠️ When adding a new text/code extension here, also update the matching
 * entry in src/renderer/utils/languageMap.ts (EXT_TO_LANGUAGE) for Monaco
 * syntax highlighting. Binary extensions (png, jpg, pdf, etc.) are only
 * needed here. The test suite validates that text extension sets stay in sync.
 */

const EXT_TO_MIME: Record<string, string> = {
  // TypeScript / JavaScript
  '.ts': 'text/typescript', '.tsx': 'text/typescript',
  '.js': 'text/javascript', '.jsx': 'text/javascript',
  '.mjs': 'text/javascript', '.cjs': 'text/javascript',
  // Python
  '.py': 'text/x-python', '.pyw': 'text/x-python', '.pyi': 'text/x-python',
  // Rust / Go
  '.rs': 'text/x-rust', '.go': 'text/x-go',
  // Java / Kotlin / Scala
  '.java': 'text/x-java', '.kt': 'text/x-kotlin', '.kts': 'text/x-kotlin',
  '.scala': 'text/x-scala',
  // C / C++
  '.c': 'text/x-c', '.cpp': 'text/x-c++', '.cc': 'text/x-c++',
  '.cxx': 'text/x-c++', '.h': 'text/x-c', '.hpp': 'text/x-c++',
  // C#
  '.cs': 'text/x-csharp',
  // Swift
  '.swift': 'text/x-swift',
  // Dart
  '.dart': 'text/x-dart',
  // Ruby
  '.rb': 'text/x-ruby',
  // PHP
  '.php': 'text/x-php',
  // Lua
  '.lua': 'text/x-lua',
  // R
  '.r': 'text/x-r',
  // Shell
  '.sh': 'text/x-shellscript', '.bash': 'text/x-shellscript',
  '.zsh': 'text/x-shellscript', '.fish': 'text/x-shellscript',
  // SQL
  '.sql': 'text/x-sql',
  // Markdown
  '.md': 'text/markdown', '.mdx': 'text/markdown',
  // HTML / CSS
  '.html': 'text/html', '.htm': 'text/html',
  '.css': 'text/css', '.scss': 'text/x-scss', '.less': 'text/x-less',
  // JSON
  '.json': 'application/json', '.jsonc': 'application/json',
  // XML / SVG
  '.xml': 'text/xml', '.svg': 'image/svg+xml',
  // YAML / TOML / INI
  '.yaml': 'text/yaml', '.yml': 'text/yaml',
  '.toml': 'text/plain', '.ini': 'text/plain', '.cfg': 'text/plain', '.env': 'text/plain',
  // Diff / Patch
  '.diff': 'text/x-diff', '.patch': 'text/x-diff',
  // Images
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.ico': 'image/x-icon',
  // PDF
  '.pdf': 'application/pdf',
  // Text
  '.txt': 'text/plain', '.log': 'text/plain', '.csv': 'text/csv',
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
