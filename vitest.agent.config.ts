import { defineConfig } from 'vitest/config'

// Feature flags default to true in test mode (same as dev).
// Individual tests can override with enableFeature()/disableFeature().
const featureTestDefines: Record<string, string> = {}
for (const name of [
  'SNIP_COMPACT', 'CACHED_MICROCOMPACT', 'CONTEXT_COLLAPSE',
  'REACTIVE_COMPACT', 'PROMPT_CACHING', 'STREAMING_TOOL_DISCARD',
  'MAX_OUTPUT_RECOVERY', 'PROVIDER_FALLBACK', 'ATTACHMENT_SYSTEM',
  'MEMORY_PREFETCH', 'TELEMETRY_EVENTS', 'STRUCTURED_OUTPUT',
  'MEDIA_ERROR_RECOVERY', 'SLASH_COMMANDS_IN_LOOP',
]) {
  featureTestDefines[`globalThis.__FEATURE_${name}__`] = 'true'
}

export default defineConfig({
  define: featureTestDefines,
  test: {
    globals: true,
    environment: 'node',
    include: ['test/agent/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
