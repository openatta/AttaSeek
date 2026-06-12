/**
 * languageMap — unified file extension → Monaco language identifier mapping.
 *
 * Single source of truth used by FilePreviewArea, DiffView, and any
 * other component that needs syntax highlighting for a given file path.
 * Also supports filename-based detection for files without extensions
 * (Dockerfile, Makefile, etc.).
 *
 * ⚠️ When adding a new text/code extension here, also update the matching
 * entry in src/shared/types/mime.ts (EXT_TO_MIME) for MIME type detection.
 * The test suite validates that text extension sets stay in sync.
 */

const EXT_TO_LANGUAGE: Record<string, string> = {
  // TypeScript / JavaScript
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  // Python
  py: 'python', pyw: 'python', pyi: 'python',
  // Rust / Go
  rs: 'rust', go: 'go',
  // Java / Kotlin / Scala
  java: 'java', kt: 'kotlin', kts: 'kotlin', scala: 'scala',
  // C / C++
  c: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', h: 'c', hpp: 'cpp',
  // C#
  cs: 'csharp',
  // Swift
  swift: 'swift',
  // Dart
  dart: 'dart',
  // Ruby
  rb: 'ruby',
  // PHP
  php: 'php',
  // Lua
  lua: 'lua',
  // R
  r: 'r',
  // Shell
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  // SQL
  sql: 'sql',
  // Markdown
  md: 'markdown', mdx: 'markdown',
  // HTML / CSS / SCSS / Less
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', less: 'less',
  // JSON / JSONC
  json: 'json', jsonc: 'json',
  // XML / SVG
  xml: 'xml', svg: 'xml',
  // YAML
  yaml: 'yaml', yml: 'yaml',
  // TOML
  toml: 'ini',
  // INI / ENV / Config
  ini: 'ini', cfg: 'ini', env: 'ini',
  // Diff / Patch
  diff: 'diff', patch: 'diff',
  // Docker
  dockerfile: 'dockerfile',
  // Makefile
  makefile: 'makefile',
  // Plain text (explicit)
  txt: 'plaintext', log: 'plaintext', csv: 'plaintext',
}

const PLAINTEXT = 'plaintext'

/** Well-known filenames that map to a language regardless of extension */
const FILENAME_TO_LANGUAGE: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  vagrantfile: 'ruby',
  gemfile: 'ruby',
  rakefile: 'ruby',
  license: 'plaintext',
  copying: 'plaintext',
  notice: 'plaintext',
}

/**
 * Map a file path (or extension) to a Monaco language identifier.
 * Returns 'plaintext' for unknown extensions.
 * Falls back to filename-based detection if no extension match.
 */
export function languageFromPath(filePath: string): string {
  const name = filePath.split('/').pop() || filePath
  const ext = name.split('.').pop()?.toLowerCase() || ''

  // Known extension → language
  const extMatch = EXT_TO_LANGUAGE[ext]
  if (extMatch) return extMatch

  // No extension or unknown extension → try filename match
  const filenameMatch = languageFromFilename(name)
  if (filenameMatch) return filenameMatch

  return PLAINTEXT
}

/**
 * Detect language from a well-known filename (case-insensitive).
 * Used for files like Dockerfile, Makefile, LICENSE that have no extension.
 */
export function languageFromFilename(name: string): string | undefined {
  return FILENAME_TO_LANGUAGE[name.toLowerCase()]
}

export { EXT_TO_LANGUAGE, FILENAME_TO_LANGUAGE }
