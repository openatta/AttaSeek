/**
 * fs-utils — shared filesystem utilities for tool implementations.
 *
 * Provides a unified recursive directory walker used by search_code,
 * glob, and grep tools. Extracted to eliminate 3 copies of the same
 * skip-logic and traversal pattern.
 */

import * as fs from 'fs'
import * as path from 'path'

/** Options for the shared walkDir function */
export interface WalkOptions {
  /** Base directory to start traversal from */
  dir: string
  /** Called for each file. Return true to stop traversal early. */
  onFile: (filePath: string, relativePath: string) => boolean | void
  /** Optional file extension filter (regex). Only matching files are passed to onFile. */
  fileFilter?: RegExp
  /** Max results before early stop (checked by caller, not enforced internally) */
  maxResults?: number
}

/**
 * Recursively walk a directory tree, calling onFile for each file.
 * Skips directories starting with '.' and 'node_modules'.
 * Skips unreadable files/directories silently.
 *
 * @returns true if stopped early due to onFile returning true
 */
export function walkDir(opts: WalkOptions): boolean {
  let stopped = false
  const { dir, onFile, fileFilter } = opts

  function walk(current: string): void {
    if (stopped) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return // skip unreadable directories
    }
    for (const entry of entries) {
      if (stopped) return
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(path.join(current, entry.name))
        }
      } else if (entry.isFile()) {
        if (fileFilter && !fileFilter.test(entry.name)) continue
        const fullPath = path.join(current, entry.name)
        const relativePath = path.relative(dir, fullPath)
        if (onFile(fullPath, relativePath)) {
          stopped = true
          return
        }
      }
    }
  }

  walk(dir)
  return stopped
}
