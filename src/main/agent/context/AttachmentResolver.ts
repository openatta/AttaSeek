/**
 * AttachmentResolver — file attachment parsing, dedup, and token budgeting.
 *
 * Handles user-provided file attachments (images, documents, code files)
 * that are injected into the LLM context. Supports:
 *   - Deduplication by path + hash
 *   - Per-attachment token budget enforcement
 *   - Media type detection (image vs text)
 *   - Batch attachment messages for the LLM
 *
 * Mirrors Claude Code's attachment system (src/utils/attachments.ts).
 *
 * Phase E: core attachment support. Full image handling deferred.
 */

import type { LLMMessage } from '../llm/ModelProvider'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// ── Types ──

export interface Attachment {
  /** Absolute file path. */
  filePath: string
  /** File name (for display). */
  fileName: string
  /** File extension (lowercase, no dot). */
  extension: string
  /** File size in bytes. */
  sizeBytes: number
  /** SHA-256 hash of file content (for dedup). */
  contentHash: string
  /** MIME type hint. */
  mimeType: string
  /** File content (if text) or path reference (if binary). */
  content?: string
  /** Whether the file is binary (image, etc.). */
  isBinary: boolean
}

export interface AttachmentConfig {
  /** Maximum total attachment bytes across all files. Default: 10MB. */
  maxTotalBytes: number
  /** Maximum single file size. Default: 5MB. */
  maxFileBytes: number
  /** Maximum text content characters per attachment in prompt. Default: 20000. */
  maxContentChars: number
  /** Allowed extensions (lowercase, no dot). Empty = all allowed. */
  allowedExtensions: string[]
  /** Dedup by content hash (true) or path only (false). Default: true. */
  dedupByHash: boolean
}

export interface AttachmentResult {
  /** Resolved and validated attachments. */
  attachments: Attachment[]
  /** Attachment messages to prepend to LLM conversation. */
  messages: LLMMessage[]
  /** Total token estimate for attachment content. */
  tokenEstimate: number
  /** Paths that were skipped (too large, binary, etc.). */
  skipped: SkippedAttachment[]
}

export interface SkippedAttachment {
  filePath: string
  reason: string
}

// ── Defaults ──

const DEFAULT_CONFIG: AttachmentConfig = {
  maxTotalBytes: 10 * 1024 * 1024,   // 10 MB
  maxFileBytes: 5 * 1024 * 1024,      // 5 MB
  maxContentChars: 20_000,
  allowedExtensions: [],
  dedupByHash: true,
}

// ── Binary extensions (don't inline content) ──

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  'pdf', 'zip', 'tar', 'gz', 'bz2', '7z',
  'mp3', 'mp4', 'mov', 'avi', 'wav',
  'woff', 'woff2', 'ttf', 'eot',
  'ico', 'icns',
])

// ── Resolver ──

/**
 * Resolve and validate file attachments for LLM context injection.
 *
 * @param filePaths — list of absolute file paths
 * @param config — optional overrides
 */
export function resolveAttachments(
  filePaths: string[],
  config: Partial<AttachmentConfig> = {},
): AttachmentResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const attachments: Attachment[] = []
  const skipped: SkippedAttachment[] = []

  let totalBytes = 0
  const seenHashes = new Set<string>()
  const seenPaths = new Set<string>()

  for (const fp of filePaths) {
    // Dedup by path
    if (seenPaths.has(fp)) continue
    seenPaths.add(fp)

    // Resolve to absolute
    const absPath = path.resolve(fp)

    // Check if file exists
    let stat: fs.Stats
    try {
      stat = fs.statSync(absPath)
    } catch {
      skipped.push({ filePath: fp, reason: 'File not found or inaccessible' })
      continue
    }

    if (!stat.isFile()) {
      skipped.push({ filePath: fp, reason: 'Not a regular file' })
      continue
    }

    // Size check
    if (stat.size > cfg.maxFileBytes) {
      skipped.push({
        filePath: fp,
        reason: `File too large (${stat.size} bytes > ${cfg.maxFileBytes} max)`,
      })
      continue
    }

    if (totalBytes + stat.size > cfg.maxTotalBytes) {
      skipped.push({ filePath: fp, reason: 'Total attachment budget exceeded' })
      continue
    }

    // Extension check
    const ext = path.extname(absPath).toLowerCase().replace(/^\./, '')
    if (cfg.allowedExtensions.length > 0 && !cfg.allowedExtensions.includes(ext)) {
      skipped.push({ filePath: fp, reason: `Extension .${ext} not in allowed list` })
      continue
    }

    // Read content
    const isBinary = BINARY_EXTENSIONS.has(ext)
    let content: string | undefined
    let contentHash: string

    try {
      const buffer = fs.readFileSync(absPath)
      contentHash = crypto.createHash('sha256').update(buffer).digest('hex')

      // Dedup by hash
      if (cfg.dedupByHash && seenHashes.has(contentHash)) {
        skipped.push({ filePath: fp, reason: 'Duplicate content (same hash)' })
        continue
      }
      seenHashes.add(contentHash)

      if (!isBinary) {
        content = buffer.toString('utf-8')
        // Truncate long content
        if (content.length > cfg.maxContentChars) {
          content = content.slice(0, cfg.maxContentChars) +
            `\n...[truncated ${content.length - cfg.maxContentChars} chars]`
        }
      }
    } catch {
      skipped.push({ filePath: fp, reason: 'Failed to read file' })
      continue
    }

    totalBytes += stat.size

    attachments.push({
      filePath: absPath,
      fileName: path.basename(absPath),
      extension: ext,
      sizeBytes: stat.size,
      contentHash,
      mimeType: inferMimeType(ext),
      content,
      isBinary,
    })
  }

  // Build attachment messages
  const messages = buildAttachmentMessages(attachments)
  const tokenEstimate = estimateAttachmentTokens(attachments)

  return { attachments, messages, tokenEstimate, skipped }
}

// ── Message builder ──

function buildAttachmentMessages(attachments: Attachment[]): LLMMessage[] {
  if (attachments.length === 0) return []

  const textAttachments = attachments.filter(a => !a.isBinary && a.content)
  const binaryAttachments = attachments.filter(a => a.isBinary)

  const parts: string[] = []

  if (textAttachments.length > 0) {
    parts.push('## Attached Files\n')
    for (const att of textAttachments) {
      parts.push(`### ${att.fileName} (${att.filePath})\n\`\`\`\n${att.content}\n\`\`\``)
    }
  }

  if (binaryAttachments.length > 0) {
    parts.push('## Binary Attachments (not inlined)\n')
    for (const att of binaryAttachments) {
      parts.push(`- ${att.fileName} (${att.extension}, ${formatBytes(att.sizeBytes)})`)
    }
  }

  return [{
    role: 'user',
    content: parts.join('\n\n'),
  }]
}

// ── Token estimation ──

function estimateAttachmentTokens(attachments: Attachment[]): number {
  let total = 0
  for (const att of attachments) {
    if (att.content) {
      total += Math.ceil(att.content.length / 4)
    } else {
      // Binary: estimate based on file name + size description
      total += 10
    }
  }
  return total
}

// ── MIME inference ──

function inferMimeType(extension: string): string {
  const mimeMap: Record<string, string> = {
    'txt': 'text/plain',
    'md': 'text/markdown',
    'json': 'application/json',
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'jsx': 'text/javascript',
    'tsx': 'text/typescript',
    'html': 'text/html',
    'css': 'text/css',
    'py': 'text/x-python',
    'rs': 'text/x-rust',
    'go': 'text/x-go',
    'java': 'text/x-java',
    'c': 'text/x-c',
    'cpp': 'text/x-c++',
    'h': 'text/x-c',
    'yaml': 'text/yaml',
    'yml': 'text/yaml',
    'toml': 'text/toml',
    'xml': 'text/xml',
    'svg': 'image/svg+xml',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
  }
  return mimeMap[extension] || 'application/octet-stream'
}

// ── Helpers ──

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
