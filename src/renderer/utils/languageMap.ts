/**
 * languageMap — unified file extension → Monaco language identifier mapping.
 *
 * Single source of truth used by FilePreviewArea, DiffView, and any
 * other component that needs syntax highlighting for a given file path.
 */

const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  md: 'markdown',
  html: 'html',
  css: 'css',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  toml: 'ini',
  txt: 'plaintext',
  log: 'plaintext',
}

const PLAINTEXT = 'plaintext'

/**
 * Map a file path (or extension) to a Monaco language identifier.
 * Returns 'plaintext' for unknown extensions.
 */
export function languageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return EXT_TO_LANGUAGE[ext] || PLAINTEXT
}

export { EXT_TO_LANGUAGE }
