/** Built-in default values for all 30+ configuration keys */
import type { AttaSeekSettings } from './types'

export const DEFAULTS: AttaSeekSettings = {
  theme: 'dark', fontFamily: 'SF Pro', codeFontFamily: 'JetBrains Mono', reduceMotion: false,
  modelConfigId: '', reasoningEffort: 'medium', thinkingMode: 'auto', fastMode: 'off',
  outputStyle: 'default', contextWindowTokens: 100_000, availableModels: [],
  personality: 'pragmatic', developerInstructions: '',
  permissionMode: 'default',
  sandbox: {
    mode: 'workspace-write',
    writableRoots: ['project', '~/Documents', '~/Desktop'],
    blockedPaths: ['~/.ssh', '~/.gnupg', '~/.aws', '/etc/passwd', '/etc/shadow'],
    networkAccess: true,
    bash: { mode: 'blacklist', blockedPatterns: ['rm', 'sudo', 'chmod', 'chown', 'dd', 'mkfs', '> /dev/'], allowedCommands: [] },
  },
  shell: { loginShell: false, includeEnv: ['PATH', 'HOME', 'USER', 'LANG', 'SHELL'], excludeEnv: ['AWS_*', 'GCP_*', 'NPM_TOKEN', 'GITHUB_TOKEN'] },
  session: { cleanupPeriodDays: 30, maxSessions: 100, archiveMode: 'manual' },
  project: { defaultTrustLevel: 'untrusted' },
  permissions: { autoReviewMode: 'off' },
  editor: { mode: 'normal', tabSize: 2, wordWrap: true },
  notifications: { taskComplete: true, inputNeeded: true, soundEnabled: false },
  update: { channel: 'stable', checkOnStartup: true },
  import: { fromClaudeCode: true, fromCodexDesktop: true },
  keybindingsPath: '',
}
