/**
 * Tests for StructuredOutputTool.
 */

import { describe, it, expect } from 'vitest'
import {
  STRUCTURED_OUTPUT_TOOL_NAME,
  MAX_STRUCTURED_OUTPUT_RETRIES,
  buildStructuredOutputToolDef,
  executeStructuredOutput,
} from '../../../src/main/agent/tools/implementations/structured-output'

describe('StructuredOutputTool', () => {
  describe('buildStructuredOutputToolDef', () => {
    it('builds a tool definition with the provided schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      }
      const def = buildStructuredOutputToolDef(schema)
      expect(def.name).toBe(STRUCTURED_OUTPUT_TOOL_NAME)
      expect(def.description).toBeTruthy()
      expect(def.input_schema.type).toBe('object')
      expect(def.input_schema.properties).toBeDefined()
      expect((def.input_schema.properties as any).output).toBeDefined()
      // The output property should inherit the schema's type
      expect((def.input_schema.properties as any).output.type).toBe('object')
    })

    it('supports array schemas', () => {
      const schema = { type: 'array', items: { type: 'string' } }
      const def = buildStructuredOutputToolDef(schema)
      expect((def.input_schema.properties as any).output.type).toBe('array')
    })
  })

  describe('executeStructuredOutput', () => {
    const objectSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    }

    const arraySchema = {
      type: 'array',
      items: { type: 'string' },
    }

    it('validates a correct object output', () => {
      const result = executeStructuredOutput(
        { output: { name: 'Alice' } },
        objectSchema,
      )
      expect(result.valid).toBe(true)
      expect(result.data).toEqual({ name: 'Alice' })
    })

    it('rejects missing output field', () => {
      const result = executeStructuredOutput({}, objectSchema)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Missing required')
    })

    it('rejects null output', () => {
      const result = executeStructuredOutput({ output: null }, objectSchema)
      expect(result.valid).toBe(false)
    })

    it('rejects array when object is expected', () => {
      const result = executeStructuredOutput({ output: [1, 2, 3] }, objectSchema)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Expected an object')
    })

    it('rejects object when array is expected', () => {
      const result = executeStructuredOutput({ output: { x: 1 } }, arraySchema)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Expected an array')
    })

    it('validates a correct array output', () => {
      const result = executeStructuredOutput(
        { output: ['a', 'b', 'c'] },
        arraySchema,
      )
      expect(result.valid).toBe(true)
      expect(result.data).toEqual(['a', 'b', 'c'])
    })

    it('detects missing required properties', () => {
      const result = executeStructuredOutput(
        { output: { age: 30 } },
        objectSchema,
      )
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Missing required properties')
      expect(result.error).toContain('name')
    })

    it('handles deeply nested valid output', () => {
      const deepSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: { bio: { type: 'string' } },
              },
            },
          },
        },
      }
      const result = executeStructuredOutput(
        { output: { user: { profile: { bio: 'hello' } } } },
        deepSchema,
      )
      expect(result.valid).toBe(true)
    })

    it('handles primitive outputs', () => {
      const stringSchema = { type: 'string' }
      // For non-object, non-array schemas, we pass through
      const result = executeStructuredOutput(
        { output: 'hello world' },
        stringSchema,
      )
      expect(result.valid).toBe(true)
      expect(result.data).toBe('hello world')
    })
  })

  describe('MAX_STRUCTURED_OUTPUT_RETRIES', () => {
    it('is a reasonable number', () => {
      expect(MAX_STRUCTURED_OUTPUT_RETRIES).toBeGreaterThan(0)
      expect(MAX_STRUCTURED_OUTPUT_RETRIES).toBeLessThanOrEqual(10)
    })
  })
})
