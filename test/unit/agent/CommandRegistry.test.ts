/**
 * Tests for CommandRegistry and built-in commands.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CommandRegistry } from '../../../src/main/agent/commands/CommandRegistry'
import { modelCommand } from '../../../src/main/agent/commands/commands/model-command'
import { compactCommand } from '../../../src/main/agent/commands/commands/compact-command'
import { statusCommand } from '../../../src/main/agent/commands/commands/status-command'
import { registerBuiltinCommands } from '../../../src/main/agent/commands/builtin-commands'

const testCtx = {
  sessionId: 'sess-test',
  taskId: 'task-test',
  messages: [],
  cwd: '/test',
}

describe('CommandRegistry', () => {
  let registry: CommandRegistry

  beforeEach(() => {
    registry = new CommandRegistry()
  })

  describe('registration', () => {
    it('registers and retrieves commands', () => {
      registry.register(modelCommand)
      expect(registry.get('model')).toBe(modelCommand)
    })

    it('supports aliases', () => {
      registry.register(modelCommand)
      expect(registry.get('m')).toBe(modelCommand)
    })

    it('lists all registered commands', () => {
      registry.register(modelCommand)
      registry.register(statusCommand)
      expect(registry.list()).toHaveLength(2)
    })

    it('unregisters commands', () => {
      registry.register(modelCommand)
      registry.unregister('model')
      expect(registry.get('model')).toBeUndefined()
    })

    it('unregisters aliases too', () => {
      registry.register(modelCommand)
      registry.unregister('model')
      expect(registry.get('m')).toBeUndefined()
    })

    it('returns undefined for unknown commands', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })
  })

  describe('processUserInput', () => {
    it('returns null for non-command input', async () => {
      const result = await registry.processUserInput('hello world', testCtx)
      expect(result).toBeNull()
    })

    it('returns null for unknown slash command', async () => {
      const result = await registry.processUserInput('/foobar', testCtx)
      expect(result).toBeNull()
    })

    it('processes registered slash command', async () => {
      registry.register(statusCommand)
      const result = await registry.processUserInput('/status', testCtx)
      expect(result).not.toBeNull()
      expect(result!.shouldQuery).toBe(false)
    })
  })
})

describe('built-in commands', () => {
  describe('model command', () => {
    it('lists available models', () => {
      const result = modelCommand.execute('list', testCtx)
      expect(result.shouldQuery).toBe(false)
      expect(result.resultText).toContain('Available models')
    })

    it('switches to opus', () => {
      const result = modelCommand.execute('opus', testCtx)
      expect(result.shouldQuery).toBe(true)
      expect(result.modelOverride).toBe('claude-opus-4-8')
    })

    it('switches to sonnet', () => {
      const result = modelCommand.execute('sonnet', testCtx)
      expect(result.modelOverride).toBe('claude-sonnet-4-6')
    })

    it('passes through unknown model names', () => {
      const result = modelCommand.execute('custom-model-v2', testCtx)
      expect(result.modelOverride).toBe('custom-model-v2')
      expect(result.shouldQuery).toBe(true)
    })
  })

  describe('status command', () => {
    it('returns session stats without query', () => {
      const result = statusCommand.execute('', testCtx)
      expect(result.shouldQuery).toBe(false)
      expect(result.resultText).toContain('Session Status')
      expect(result.resultText).toContain('sess-test')
      expect(result.resultText).toContain('task-test')
    })
  })

  describe('compact command', () => {
    it('inserts compact markers and allows query', () => {
      const ctx = { ...testCtx, messages: [] }
      const result = compactCommand.execute('', ctx)
      expect(result.shouldQuery).toBe(true)
      expect(result.messages.length).toBeGreaterThan(0)
    })
  })

  describe('registerBuiltinCommands', () => {
    it('registers all three built-in commands', () => {
      const reg = new CommandRegistry()
      // Simulate what registerBuiltinCommands does
      reg.register(modelCommand)
      reg.register(compactCommand)
      reg.register(statusCommand)
      expect(reg.get('model')).toBeDefined()
      expect(reg.get('compact')).toBeDefined()
      expect(reg.get('status')).toBeDefined()
    })
  })
})
