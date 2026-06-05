import { describe, it, expect } from 'vitest'
import { ModelConfigService } from '../../../src/main/model/ModelConfigService'

describe('ModelConfigService', () => {
  it('has expected interface', () => {
    const svc = new ModelConfigService()
    expect(typeof svc.listAll).toBe('function')
    expect(typeof svc.get).toBe('function')
    expect(typeof svc.create).toBe('function')
    expect(typeof svc.update).toBe('function')
    expect(typeof svc.delete).toBe('function')
    expect(typeof svc.setDefault).toBe('function')
    expect(typeof svc.test).toBe('function')
    expect(typeof svc.hasConfigured).toBe('function')
    expect(typeof svc.loadAll).toBe('function')
  })

  it('hasConfigured returns boolean', () => {
    const svc = new ModelConfigService()
    expect(typeof svc.hasConfigured()).toBe('boolean')
  })
})
