/** push_notification tool — sends desktop notification via Electron */
export const pushNotificationImpl = {
  toolId: 'push_notification',
  execute: async (input: Record<string, unknown>) => {
    const message = String(input.message || '')
    if (!message) throw new Error('message is required')
    try {
      const { Notification } = await import('electron')
      if (Notification.isSupported()) {
        new Notification({ title: 'AttaSeek Agent', body: message.slice(0, 200) }).show()
        return `Notification sent: ${message.slice(0, 100)}`
      }
      return '[Notifications not supported on this platform]'
    } catch {
      return `[Notification: ${message.slice(0, 200)}]`
    }
  },
}
