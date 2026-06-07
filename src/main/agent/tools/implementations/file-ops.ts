/** File operation tools — write_file, edit_file, glob, grep */
import * as fs from 'fs'; import * as path from 'path'
import { walkDir } from '../../../tools/fs-utils'
export const writeFileImpl = {
  toolId: 'write_file',
  execute: async (input: Record<string, unknown>) => {
    const filePath = String(input.path || ''); const content = String(input.content || '')
    if (!filePath) throw new Error('path is required')
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    // Atomic write: temp file → rename
    const tmp = filePath + '.tmp'
    fs.writeFileSync(tmp, content, 'utf-8')
    fs.renameSync(tmp, filePath)
    return `Wrote ${content.length} bytes to ${filePath}`
  },
}

export const editFileImpl = {
  toolId: 'edit_file',
  execute: async (input: Record<string, unknown>) => {
    const filePath = String(input.path || ''); const oldStr = String(input.old_string || '')
    const newStr = String(input.new_string || '')
    if (!filePath || !oldStr) throw new Error('path and old_string are required')
    const content = fs.readFileSync(filePath, 'utf-8')
    if (!content.includes(oldStr)) throw new Error(`old_string not found in ${filePath}`)
    const count = content.split(oldStr).length - 1
    const updated = content.replaceAll(oldStr, newStr)
    const tmp = filePath + '.tmp'
    fs.writeFileSync(tmp, updated, 'utf-8')
    fs.renameSync(tmp, filePath)
    return `Replaced ${count} occurrence(s) in ${filePath}`
  },
}

export const globImpl = {
  toolId: 'glob',
  execute: async (input: Record<string, unknown>) => {
    const pattern = String(input.pattern || '**/*'); const cwd = String(input.cwd || process.cwd())
    const results: string[] = []
    walkDir({
      dir: cwd,
      onFile: (_full, rel) => {
        if (matchGlob(rel, pattern)) { results.push(rel); if (results.length >= 500) return true }
      },
    })
    return results.slice(0, 500).join('\n') || '(no matches)'
  },
}

export const grepImpl = {
  toolId: 'grep',
  execute: async (input: Record<string, unknown>) => {
    const pattern = String(input.pattern || ''); const cwd = String(input.cwd || process.cwd())
    if (!pattern) throw new Error('pattern is required')
    const results: string[] = []
    walkDir({
      dir: cwd,
      onFile: (fp, rel) => {
        try {
          const lines = fs.readFileSync(fp, 'utf-8').split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(pattern)) {
              results.push(`${rel}:${i + 1}:${lines[i].trim()}`)
              if (results.length >= 1000) return true
            }
          }
        } catch { /* skip unreadable */ }
      },
    })
    return results.slice(0, 1000).join('\n') || '(no matches)'
  },
}

function matchGlob(str: string, pattern: string): boolean {
  const re = new RegExp('^' + pattern.replace(/\*\*/g, '<<<GLOBSTAR>>>').replace(/\*/g, '[^/]*').replace(/<<<GLOBSTAR>>>/g, '.*') + '$')
  return re.test(str)
}
