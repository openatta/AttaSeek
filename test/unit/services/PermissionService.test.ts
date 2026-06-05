import { describe, it, expect } from 'vitest'
import { PermissionService } from '../../../src/main/permission/PermissionService'

describe('PermissionService', () => {
  it('creates and resolves permission requests', () => {
    const svc = new PermissionService()
    const req = svc.requestPermission('t1', 'tc1', 'git', 'Git Push', 'risky', 'push', 'diff', 'remote', true)
    expect(req.status).toBe('pending')
    const r = svc.resolveRequest(req.id, 'allow')
    expect(r?.status).toBe('allowed')
  })

  it('denies requests', () => {
    const svc = new PermissionService()
    const req = svc.requestPermission('t1', 'tc2', 'send', 'Send', 'risky', 'send', 'email', 'to user', false)
    const r = svc.resolveRequest(req.id, 'deny')
    expect(r?.status).toBe('denied')
  })

  it('returns null for unknown request', () => {
    const svc = new PermissionService()
    expect(svc.resolveRequest('nonexistent', 'allow')).toBeNull()
  })
})

// Note: SQLite-backed CRUD (savePolicy/listPolicies/updatePolicy/deletePolicy/check)
// is tested via E2E integration because better-sqlite3 requires Electron's Node runtime.
