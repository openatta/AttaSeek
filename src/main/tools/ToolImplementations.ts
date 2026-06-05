/**
 * ToolImplementations — real tool execution functions.
 *
 * Each tool ID maps to an async function that receives the tool input
 * and returns the tool output. These run in the main process with
 * full Node.js API access.
 *
 * MVP tools: read_file, create_document, search_code.
 * Mock (preview-only): send_email, git_commit.
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { artifactService } from '../artifacts/ArtifactService'
import type { ArtifactType } from '../../renderer/core/types/Artifact'

export type ToolImpl = (input: Record<string, unknown>) => Promise<unknown>

// ── Allowed file paths (sandbox) ──

function getAllowedRoots(): string[] {
  try {
    return [
      process.cwd(),
      app.getPath('home'),
      app.getPath('documents'),
      app.getPath('desktop'),
    ]
  } catch {
    // Test environment — fall back to cwd only
    return [process.cwd()]
  }
}

function isPathAllowed(filePath: string): boolean {
  const resolved = path.resolve(filePath)
  const roots = getAllowedRoots()
  return roots.some((root) => resolved.startsWith(path.resolve(root)))
}

function safeResolve(filePath: string): string {
  const resolved = path.resolve(filePath)
  if (!isPathAllowed(resolved)) {
    throw new Error(`Access denied: ${filePath} is outside allowed directories`)
  }
  return resolved
}

// ── Tool implementations ──

export const TOOL_IMPLS: Record<string, ToolImpl> = {
  /** Read file content from the local filesystem */
  read_file: async (input) => {
    const filePath = input.path as string
    if (!filePath) throw new Error('Missing required input: path')

    const resolved = safeResolve(filePath)
    if (!fs.existsSync(resolved)) {
      const err = new Error(`File not found: ${filePath}`)
      ;(err as any).code = 'ENOENT'
      throw err
    }
    const content = fs.readFileSync(resolved, 'utf-8')
    const stat = fs.statSync(resolved)
    return {
      path: resolved,
      content,
      size: stat.size,
      lineCount: content.split('\n').length,
    }
  },

  /** Search code in the project directory using grep patterns */
  search_code: async (input) => {
    const pattern = input.pattern as string
    const searchPath = (input.path as string) || process.cwd()
    if (!pattern) throw new Error('Missing required input: pattern')

    const resolved = safeResolve(searchPath)
    if (!fs.existsSync(resolved)) {
      throw new Error(`Directory not found: ${searchPath}`)
    }

    const results: { file: string; line: number; content: string }[] = []
    let stopped = false
    const MAX_RESULTS = 50

    const walkDir = (dir: string): boolean => {
      if (stopped) return false
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (stopped) return false
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walkDir(full)
          }
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json|md|css|html)$/.test(entry.name)) {
          try {
            const lines = fs.readFileSync(full, 'utf-8').split('\n')
            for (let i = 0; i < lines.length && !stopped; i++) {
              if (lines[i].includes(pattern)) {
                results.push({ file: path.relative(resolved, full), line: i + 1, content: lines[i].trim() })
                if (results.length >= MAX_RESULTS) {
                  stopped = true
                  break
                }
              }
            }
          } catch { /* skip unreadable files */ }
        }
      }
      return !stopped
    }
    walkDir(resolved)
    return { pattern, matches: results.slice(0, MAX_RESULTS), total: results.length }
  },

  /** Create a new document artifact */
  create_document: async (input) => {
    const title = (input.title as string) || 'Untitled'
    const content = (input.content as string) || ''
    const type = (input.type as string) || 'markdown'
    const sessionId = (input.sessionId as string) || 'session_default'
    const taskId = (input.taskId as string) || 'task_unknown'

    const validTypes: ArtifactType[] = ['markdown', 'html', 'code', 'json', 'table']
    const artifactType: ArtifactType = validTypes.includes(type as ArtifactType) ? (type as ArtifactType) : 'markdown'

    const artifact = artifactService.create({
      sessionId,
      taskId,
      type: artifactType,
      title,
      content,
      rendererHint: type,
    })

    return { artifactId: artifact.id, title: artifact.title, type: artifact.type, version: artifact.version }
  },

  /** Send an email (mock — generates preview only) */
  send_email: async (input) => {
    const to = input.to as string
    const subject = input.subject as string
    const body = input.body as string
    return {
      preview: `To: ${to}\nSubject: ${subject}\n\n${body}`,
      note: 'This is a preview. Email not actually sent (mock mode).',
    }
  },

  /** Git commit (mock — generates diff preview only) */
  git_commit: async (input) => {
    const message = input.message as string
    const files = input.files as string[]
    return {
      diff: `# Would commit with message: "${message}"\n# Files: ${files?.join(', ') || 'none'}\n# (mock mode — no actual commit created)`,
      note: 'This is a preview. No actual git commit created (mock mode).',
    }
  },
}
