/**
 * AttaSeek configuration types — full settings.json schema.
 * Aligned with Codex Desktop + Claude Code configuration models.
 */

export interface SandboxConfig {
  mode: 'read-only' | 'workspace-write' | 'danger-full-access'
  writableRoots: string[]
  blockedPaths: string[]
  networkAccess: boolean
  bash: { mode: 'blacklist' | 'whitelist'; blockedPatterns: string[]; allowedCommands: string[] }
}

export interface ShellConfig { loginShell: boolean; includeEnv: string[]; excludeEnv: string[] }
export interface SessionConfig { cleanupPeriodDays: number; maxSessions: number; archiveMode: 'manual' | 'auto' | 'none' }
export interface ProjectConfig { defaultTrustLevel: 'untrusted' | 'trusted' }
export interface PermissionsConfig { autoReviewMode: 'off' | 'read_only' | 'full' }
export interface EditorConfig { mode: 'normal' | 'vim'; tabSize: number; wordWrap: boolean }
export interface NotificationsConfig { taskComplete: boolean; inputNeeded: boolean; soundEnabled: boolean }
export interface UpdateConfig { channel: 'stable' | 'beta' | 'nightly'; autoDownload: boolean; checkOnStartup: boolean }
export interface ImportConfig { fromClaudeCode: boolean; fromCodexDesktop: boolean }

export interface AttaSeekSettings {
  theme: 'dark' | 'light' | 'system'
  fontFamily: string; codeFontFamily: string; reduceMotion: boolean
  modelConfigId: string; reasoningEffort: 'low' | 'medium' | 'high'
  thinkingMode: 'auto' | 'enabled' | 'disabled'; fastMode: 'off' | 'on' | 'auto'
  outputStyle: 'default' | 'concise' | 'detailed'; contextWindowTokens: number
  availableModels: string[]
  personality: string; developerInstructions: string
  permissionMode: 'default' | 'auto' | 'trust'
  sandbox: SandboxConfig; shell: ShellConfig; session: SessionConfig
  project: ProjectConfig; permissions: PermissionsConfig
  editor: EditorConfig; notifications: NotificationsConfig; update: UpdateConfig; import: ImportConfig
  keybindingsPath: string
  [key: string]: unknown
}
