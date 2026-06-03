export interface PluginItem {
  id: string
  name: string
  icon: string
  version: string
  description: string
  installed: boolean
}

export interface PluginCategory {
  id: string
  label: string
  plugins: PluginItem[]
}

export const MOCK_CATEGORIES: PluginCategory[] = [
  {
    id: 'local-tools',
    label: 'Local Tools',
    plugins: [
      { id: 'filesystem', name: 'Filesystem', icon: '📁', version: '1.2.0', description: 'Sandboxed file system access for AI agents', installed: true },
      { id: 'terminal', name: 'Terminal', icon: '💻', version: '1.0.0', description: 'Integrated terminal with command execution', installed: true },
      { id: 'sqlite', name: 'SQLite', icon: '🗄️', version: '0.5.1', description: 'Local SQLite database query and management', installed: true }
    ]
  },
  {
    id: 'cloud-services',
    label: 'Cloud Services',
    plugins: [
      { id: 'github', name: 'GitHub', icon: '🐙', version: '2.0.1', description: 'GitHub PRs, issues, and repo management', installed: true },
      { id: 'slack', name: 'Slack', icon: '💬', version: '1.5.0', description: 'Slack messaging and channel integration', installed: true },
      { id: 'notion', name: 'Notion', icon: '📝', version: '1.0.0', description: 'Notion pages and database access', installed: false },
      { id: 'supabase', name: 'Supabase', icon: '⚡', version: '0.8.2', description: 'Supabase database and auth integration', installed: true }
    ]
  },
  {
    id: 'ai-models',
    label: 'AI Models',
    plugins: [
      { id: 'openai', name: 'OpenAI', icon: '🧠', version: '3.0.0', description: 'OpenAI GPT-4, GPT-4o model access', installed: true },
      { id: 'claude', name: 'Claude', icon: '🟣', version: '2.1.0', description: 'Anthropic Claude Opus/Sonnet/Haiku models', installed: true },
      { id: 'gemini', name: 'Gemini', icon: '🔮', version: '1.5.0', description: 'Google Gemini 2.0 model access', installed: false }
    ]
  },
  {
    id: 'dev-tools',
    label: 'Dev Tools',
    plugins: [
      { id: 'docker', name: 'Docker', icon: '🐳', version: '2.0.0', description: 'Container management and Docker Compose', installed: true },
      { id: 'redis', name: 'Redis', icon: '🔴', version: '1.0.0', description: 'Redis cache and pub/sub integration', installed: false },
      { id: 'postgresql', name: 'PostgreSQL', icon: '🐘', version: '1.2.0', description: 'PostgreSQL database client and tools', installed: true },
      { id: 'eslint', name: 'ESLint', icon: '✅', version: '0.9.0', description: 'Code linting and auto-fix integration', installed: true },
      { id: 'prettier', name: 'Prettier', icon: '✨', version: '1.0.0', description: 'Code formatting with configurable rules', installed: true }
    ]
  },
  {
    id: 'productivity',
    label: 'Productivity',
    plugins: [
      { id: 'gcal', name: 'Google Calendar', icon: '📅', version: '1.0.0', description: 'Calendar events and scheduling', installed: false },
      { id: 'todoist', name: 'Todoist', icon: '✅', version: '0.9.0', description: 'Task management and reminders', installed: true }
    ]
  }
]
