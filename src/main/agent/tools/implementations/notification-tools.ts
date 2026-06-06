/** Notification tool manifests — registered in ToolRegistry for desktop notification operations. */
import type { ToolManifest } from '../../../../shared/types/Tool'

const outputSchema = { type: 'object' as const, properties: {} }
const permissionPolicy = { default: 'allow' as const, requirePreview: false, allowAlways: false }

export const NOTIFICATION_TOOLS: ToolManifest[] = [
  { id: 'push_notification', pluginId: 'builtin', name: 'Push Notification', description: 'Send a desktop notification to the user', riskLevel: 'write' as const, inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] }, outputSchema, category: 'notification' as const, permissionPolicy },
]
