/**
 * Shared locale messages — single source of truth for all user-facing strings.
 *
 * Used by both:
 *   - Renderer process (via React useTranslation hook)
 *   - Main process (via the shared t() function in ./index.ts)
 *
 * When adding a new key, add it to both 'zh' and 'en' blocks.
 */

export interface LocaleMessages {
  [key: string]: string
}

export const zh: LocaleMessages = {
  'tray.hideWindow': '隐藏窗口',
  'tray.showWindow': '显示窗口',
  'tray.newChat.mac': '新建对话 (⌘N)',
  'tray.newChat.other': '新建对话 (Ctrl+N)',
  'tray.conversations': '对话',
  'tray.noConversations': '暂无对话',
  'tray.quit.mac': '退出 AttaSeek (⌘Q)',
  'tray.quit.other': '退出 AttaSeek',
  'tray.quitWithTasks': '有 {count} 个任务正在运行，退出将中断它们。确定退出吗？',
  'tray.quit': '退出',
  'tray.cancel': '取消',
  'tray.appTitle': 'AttaSeek',
  'tray.runningInBackground': 'AttaSeek 仍在后台运行。可通过托盘图标恢复窗口。',

  'general.traySection': '系统托盘',
  'general.minimizeToTray': '关闭窗口时最小化到托盘',
  'general.minimizeToTray.desc': '点击关闭按钮时隐藏窗口到系统托盘，应用继续在后台运行',
  'general.autoLaunch': '开机自动启动',
  'general.autoLaunch.desc': '登录系统时自动启动 AttaSeek',
  'general.startMinimized': '启动时最小化到托盘',
  'general.startMinimized.desc': '开机启动时不弹出主窗口，直接最小化到托盘',
  'general.startMinimized.disabledDesc': '需先开启"开机自动启动"',
}

export const en: LocaleMessages = {
  'tray.hideWindow': 'Hide Window',
  'tray.showWindow': 'Show Window',
  'tray.newChat.mac': 'New Chat (⌘N)',
  'tray.newChat.other': 'New Chat (Ctrl+N)',
  'tray.conversations': 'Conversations',
  'tray.noConversations': 'No conversations',
  'tray.quit.mac': 'Quit AttaSeek (⌘Q)',
  'tray.quit.other': 'Quit AttaSeek',
  'tray.quitWithTasks': '{count} task(s) are still running. Quitting will interrupt them. Are you sure?',
  'tray.quit': 'Quit',
  'tray.cancel': 'Cancel',
  'tray.appTitle': 'AttaSeek',
  'tray.runningInBackground': 'AttaSeek is still running in the background. Use the tray icon to restore the window.',

  'general.traySection': 'System Tray',
  'general.minimizeToTray': 'Minimize to tray on close',
  'general.minimizeToTray.desc': 'Hide the window to the system tray when clicking close, keep the app running in background',
  'general.autoLaunch': 'Launch at startup',
  'general.autoLaunch.desc': 'Automatically start AttaSeek when you log in',
  'general.startMinimized': 'Start minimized to tray',
  'general.startMinimized.desc': 'Start without showing the main window, minimize directly to tray',
  'general.startMinimized.disabledDesc': 'Enable "Launch at startup" first',
}

export type Locale = 'zh' | 'en'
