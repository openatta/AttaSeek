/** Bash tool manifest — shell command execution with safety filters. */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'ask' as const, requirePreview: true, allowAlways: false }

export const BASH_TOOLS: ToolManifest[] = [
  {
    id: 'bash',
    pluginId: 'builtin',
    name: 'Bash',
    description: 'Execute a shell command in the project directory. Blocked: rm, rmdir, chmod, chown, sudo, dd, mkfs. Timeout: 30s default.',
    riskLevel: 'risky',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        timeout_ms: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
        cwd: { type: 'string', description: 'Working directory (default: project root)' },
      },
      required: ['command'],
    },
    outputSchema,
    category: 'code',
    permissionPolicy,
  },
]
