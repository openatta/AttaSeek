export const en: Record<string, string> = {
  // ActivityBar
  'activity.home': 'Home', 'activity.chat': 'New Session', 'activity.search': 'Search',
  'activity.automation': 'Automation', 'activity.plugins': 'Plugins', 'activity.projects': 'Projects',
  'activity.settings': 'Settings',

  // Settings sidebar
  'settings.general': 'General', 'settings.appearance': 'Appearance', 'settings.model': 'Model',
  'settings.agent': 'Agent', 'settings.permissions': 'Permissions', 'settings.memory': 'Memory',
  'settings.keyboard': 'Keyboard', 'settings.notifications': 'Notifications', 'settings.updates': 'Updates',

  // General
  'general.title': 'General', 'general.language': 'Language',
  'general.permissionMode': 'Permission Mode', 'general.permissionMode.desc': 'Default tool approval behavior',
  'general.permission.default': 'Default Review', 'general.permission.auto': 'Auto Approve', 'general.permission.trust': 'Full Trust',
  'general.sandbox': 'Sandbox Mode', 'general.sandbox.desc': 'Agent file system access',
  'general.sandbox.readonly': 'Read Only', 'general.sandbox.workspace': 'Workspace Write', 'general.sandbox.full': 'Full Access',

  // Appearance
  'appearance.title': 'Appearance', 'appearance.theme': 'Theme',
  'appearance.theme.dark': 'Dark', 'appearance.theme.light': 'Light', 'appearance.theme.system': 'System',
  'appearance.uifont': 'UI Font', 'appearance.codefont': 'Code Font',

  // Model
  'model.title': 'Model Configure', 'model.add': 'Add Model', 'model.edit': 'Edit',
  'model.test': 'Test', 'model.save': 'Save', 'model.cancel': 'Cancel', 'model.back': 'Back',
  'model.name': 'Name', 'model.name.placeholder': 'e.g. My DeepSeek',
  'model.apiKey': 'API Key', 'model.apiKey.placeholder': 'sk-...',
  'model.apiKey.saved': '(saved — enter new key to change)',
  'model.apiKey.none': '(no key saved)',
  'model.template': 'Provider Template', 'model.template.custom': 'Custom configuration...',
  'model.advanced': 'Advanced', 'model.interface': 'Interface',
  'model.endpoint': 'Endpoint URL', 'model.defaultModel': 'Default Model',
  'model.models': 'Models (comma-separated)', 'model.extraParams': 'Extra Params (JSON)',
  'model.connected': 'Connected',
  'model.connectionFailed': 'Connection failed',
  'model.noModel': 'No model configured',
  'model.noModelDesc': 'Add an LLM provider to start using the agent.',
  'model.deleteConfirm': 'Delete this model configuration?',
  'model.setDefault': 'Set as default',
  'model.isDefault': 'Default',
  'model.copyId': 'Copy ID',

  // Agent
  'agent.title': 'Agent Behavior', 'agent.personality': 'Personality',
  'agent.personality.pragmatic': 'Pragmatic', 'agent.personality.verbose': 'Verbose', 'agent.personality.concise': 'Concise',
  'agent.thinking': 'Thinking Mode', 'agent.thinking.desc': 'Extended thinking (Opus)',
  'agent.thinking.auto': 'Auto', 'agent.thinking.enabled': 'On', 'agent.thinking.disabled': 'Off',
  'agent.fastMode': 'Fast Mode', 'agent.fastMode.off': 'Off', 'agent.fastMode.on': 'On', 'agent.fastMode.auto': 'Auto',
  'agent.outputStyle': 'Output Style',
  'agent.outputStyle.default': 'Default', 'agent.outputStyle.concise': 'Concise', 'agent.outputStyle.detailed': 'Detailed',
  'agent.editorMode': 'Editor Mode', 'agent.editorMode.normal': 'Normal', 'agent.editorMode.vim': 'Vim',
  'agent.instructions': 'Custom Instructions',
  'agent.instructions.placeholder': 'Always use strict TypeScript...',

  // Permissions
  'permissions.title': 'Permissions', 'permissions.desc': 'Configure which tools are allowed, require confirmation, or are denied.',
  'permissions.noData': 'No custom policies defined.',

  // Memory
  'memory.title': 'Memory', 'memory.noData': 'No memory entries.',

  // Keyboard
  'keyboard.title': 'Keyboard Shortcuts', 'keyboard.desc': 'VS Code format. Edit:',
  'keyboard.send': 'Send message', 'keyboard.clear': 'Clear composer',

  // Notifications
  'notifications.title': 'Notifications',
  'notifications.taskComplete': 'Task Complete', 'notifications.taskComplete.desc': 'Notify when agent finishes a task',
  'notifications.inputNeeded': 'Input Needed', 'notifications.inputNeeded.desc': 'Notify when agent needs your input',
  'notifications.sound': 'Sound', 'notifications.sound.desc': 'Play sound with notifications',

  // Updates
  'updates.title': 'Updates',
  'updates.currentVersion': 'Current version',
  'updates.channel': 'Update channel',
  'updates.channel.desc': 'Choose which release track to follow',
  'updates.autoDownload': 'Auto-download',
  'updates.autoDownload.desc': 'Download updates in the background',
  'updates.checkOnStartup': 'Check on startup',
  'updates.checkOnStartup.desc': 'Check for updates when AttaSeek starts',
  'updates.checking': 'Checking…',
  'updates.checkNow': 'Check for updates',

  // Composer
  'composer.placeholder': 'Ask anything…',
  'composer.send': 'Send', 'composer.stop': 'Stop generating',
  'composer.defaultReview': 'Default Review', 'composer.autoReview': 'Auto Review', 'composer.fullTrust': 'Full Trust',
  'composer.reasoning.low': 'Low', 'composer.reasoning.medium': 'Medium', 'composer.reasoning.high': 'High',

  // ChatsList
  'chats.search': 'Search chats...', 'chats.noConversations': 'No conversations yet',
  'chats.rename': 'Rename', 'chats.delete': 'Delete', 'chats.newSession': 'New Session',
  'chats.copyId': 'Copy ID',

  // Common
  'common.save': 'Save', 'common.cancel': 'Cancel', 'common.delete': 'Delete',
  'common.edit': 'Edit', 'common.close': 'Close', 'common.loading': 'Loading...',
  'common.error': 'Error', 'common.copied': 'Copied!',

  'project.new': 'New Project', 'project.removeConfirm': 'Remove this project? Session records under it will be deleted. This cannot be undone.',
  'project.directoryMissing': 'Project directory missing or inaccessible', 'project.removeAction': 'Remove project',
  'project.delete': 'Delete project', 'project.noSessions': 'No sessions',
}
