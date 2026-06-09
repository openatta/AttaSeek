/**
 * StructuredOutputTool — synthetic tool for structured JSON output enforcement.
 *
 * When `jsonSchema` is provided in query-loop params, this tool is injected
 * into the tool list. The model calls it to signal that it has produced valid
 * JSON conforming to the schema. The tool validates the input against the
 * schema and returns it for extraction into the final result.
 *
 * Mirrors Claude Code's SyntheticOutputTool (src/tools/SyntheticOutputTool/).
 *
 * Design:
 *   - The tool IS the output — calling it means "here's my structured response"
 *   - Validation is best-effort (basic JSON + key check); full AJV validation
 *     could be added later
 *   - On mismatch, returns an informative error so the model can self-correct
 */

import type { LLMToolDef } from '../../llm/ModelProvider'

// ── Constants ──

/** Tool name constant — used to detect StructuredOutput calls in the query loop. */
export const STRUCTURED_OUTPUT_TOOL_NAME = 'StructuredOutput'

/** Max retries before giving up on structured output. */
export const MAX_STRUCTURED_OUTPUT_RETRIES = 5

// ── Tool definition ──

/**
 * Build the StructuredOutput tool definition for the given JSON schema.
 * The tool's input_schema wraps the user-provided schema so the model
 * knows the exact shape to produce.
 */
export function buildStructuredOutputToolDef(jsonSchema: Record<string, unknown>): LLMToolDef {
  return {
    name: STRUCTURED_OUTPUT_TOOL_NAME,
    description: `Return structured output in the requested format. You MUST call this tool exactly once at the end of your response to provide the structured output that conforms to the requested schema.`,
    input_schema: {
      type: 'object',
      properties: {
        output: {
          description: 'The structured output matching the requested schema.',
          ...jsonSchema,
        },
      },
      required: ['output'],
    },
  }
}

// ── Execution ──

export interface StructuredOutputResult {
  /** Whether the output validated successfully against the schema. */
  valid: boolean
  /** The parsed structured output (valid case). */
  data?: unknown
  /** Validation error message (invalid case). */
  error?: string
}

/**
 * Execute the StructuredOutput tool — parse and validate the model's output
 * against the expected schema.
 *
 * @param input    — The raw tool input from the model ({ output: ... }).
 * @param jsonSchema — The expected JSON schema for validation.
 */
export function executeStructuredOutput(
  input: Record<string, unknown>,
  jsonSchema: Record<string, unknown>,
): StructuredOutputResult {
  try {
    const output = input.output
    if (output === undefined || output === null) {
      return {
        valid: false,
        error: 'Missing required "output" field. Provide your structured output as the "output" parameter.',
      }
    }

    // Basic schema validation: check that output has the expected type
    const schemaType = jsonSchema.type as string | undefined
    if (schemaType === 'object' && (typeof output !== 'object' || output === null || Array.isArray(output))) {
      return {
        valid: false,
        error: `Expected an object but got ${Array.isArray(output) ? 'array' : typeof output}. Provide a JSON object matching the schema.`,
      }
    }
    if (schemaType === 'array' && !Array.isArray(output)) {
      return {
        valid: false,
        error: `Expected an array but got ${typeof output}. Provide a JSON array matching the schema.`,
      }
    }

    // Check required properties if schema has them
    const required = jsonSchema.required as string[] | undefined
    const properties = jsonSchema.properties as Record<string, unknown> | undefined
    if (required && properties && typeof output === 'object' && output !== null && !Array.isArray(output)) {
      const missing = required.filter(k => !(k in output))
      if (missing.length > 0) {
        return {
          valid: false,
          error: `Missing required properties: ${missing.join(', ')}. Include these in your output object.`,
        }
      }
    }

    return { valid: true, data: output }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Failed to parse structured output',
    }
  }
}

// ── Tool implementation (for ToolExecutor) ──

export const structuredOutputImpl = {
  toolId: STRUCTURED_OUTPUT_TOOL_NAME,
  execute: async (input: Record<string, unknown>): Promise<unknown> => {
    // The jsonSchema is passed via a closure when building the tool;
    // here we just pass through — validation happens in executeStructuredOutput.
    return {
      structured_output: input.output,
      validated: true,
    }
  },
}
