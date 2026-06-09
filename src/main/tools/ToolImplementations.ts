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
import { walkDir } from './fs-utils'
import { artifactService } from '../artifacts/ArtifactService'
import type { ArtifactType } from '../../shared/types/Artifact'
import { webSearchImpl, webFetchImpl, sourceVerifyImpl, citeSourceImpl } from '../agent/tools/implementations/web-tools'
import { lspDiagnosticImpl, lspDefinitionImpl, lspReferencesImpl } from '../agent/tools/implementations/lsp'
import { pushNotificationImpl } from '../agent/tools/implementations/notification'
import { bashImpl } from '../agent/tools/implementations/bash'
import { writeFileImpl, editFileImpl, globImpl, grepImpl } from '../agent/tools/implementations/file-ops'
import { reviewDocumentImpl, formatDocumentImpl, outlineDocumentImpl } from '../agent/tools/implementations/document-tools'
import { taskCreateImpl, taskUpdateImpl, taskListImpl, taskOutputImpl, taskStopImpl } from '../agent/tools/implementations/task-mgmt'
import { spawnAgentImpl } from '../agent/tools/implementations/agent-tool-impl'
import { sendMessageImpl } from '../agent/tools/implementations/send-message-impl'
import { invokeSkillImpl } from '../agent/tools/implementations/skill-tool-impl'
import { askUserQuestionImpl } from '../agent/tools/implementations/question-impl'
import { enterPlanModeImpl, exitPlanModeImpl } from '../agent/tools/implementations/plan-impl'
import { todoWriteImpl } from '../agent/tools/implementations/todo-impl'
import { cronCreateImpl, cronDeleteImpl, cronListImpl } from '../agent/tools/implementations/cron-tools'
import { monitorImpl } from '../agent/tools/implementations/monitor-tools'
import { workflowImpl } from '../agent/tools/implementations/workflow-tools'

import type { LLMMessage } from '../agent/llm/ModelProvider'

export interface ToolExecContext {
  taskId: string
  sessionId: string
  projectId?: string
  /** Parent conversation messages for context inheritance (coordinator forkWithContext). */
  parentMessages?: LLMMessage[]
}

export type ToolImplFn = (input: Record<string, unknown>, ctx?: ToolExecContext) => Promise<unknown>
export type ToolImplObj = { toolId: string; execute: ToolImplFn }
export type ToolImpl = ToolImplFn | ToolImplObj

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
    const MAX_RESULTS = 50
    const FILE_FILTER = /\.(ts|tsx|js|jsx|json|md|css|html)$/

    walkDir({
      dir: resolved,
      fileFilter: FILE_FILTER,
      onFile: (full, rel) => {
        try {
          const lines = fs.readFileSync(full, 'utf-8').split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(pattern)) {
              results.push({ file: rel, line: i + 1, content: lines[i].trim() })
              if (results.length >= MAX_RESULTS) return true
            }
          }
        } catch { /* skip unreadable files */ }
      },
    })
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

  // ── Research tools ──
  web_search: webSearchImpl,
  web_fetch: webFetchImpl,
  source_verify: sourceVerifyImpl,
  cite_source: citeSourceImpl,

  // ── LSP tools ──
  lsp_diagnostic: lspDiagnosticImpl,
  lsp_definition: lspDefinitionImpl,
  lsp_references: lspReferencesImpl,

  // ── Notification ──
  push_notification: pushNotificationImpl,

  // ── Shell ──
  bash: bashImpl,

  // ── File operations ──
  write_file: writeFileImpl,
  edit_file: editFileImpl,
  glob: globImpl,
  grep: grepImpl,

  // ── Document / writing ──
  review_document: reviewDocumentImpl,
  format_document: formatDocumentImpl,
  outline_document: outlineDocumentImpl,

  // ── Task management ──
  task_create: taskCreateImpl,
  task_update: taskUpdateImpl,
  task_list: taskListImpl,
  task_output: taskOutputImpl,
  task_stop: taskStopImpl,

  // ── Sub-agent ──
  spawn_agent: spawnAgentImpl,
  send_message: sendMessageImpl,

  // ── Skill ──
  invoke_skill: invokeSkillImpl,

  // ── User interaction ──
  ask_user_question: askUserQuestionImpl,

  // ── Plan mode ──
  enter_plan_mode: enterPlanModeImpl,
  exit_plan_mode: exitPlanModeImpl,

  // ── Todo ──
  todo_write: todoWriteImpl,

  // ── Cron scheduling ──
  cron_create: cronCreateImpl,
  cron_delete: cronDeleteImpl,
  cron_list: cronListImpl,

  // ── Monitor ──
  monitor: monitorImpl,

  // ── Workflow ──
  workflow: workflowImpl,
}
