/**
 * Standalone Vite config for serving only the renderer (no Electron).
 * Used by Playwright mock tests to serve the React app in a regular browser.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname, '..'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src/renderer'),
    },
  },
  server: {
    port: 5199,
    strictPort: true,
  },
  define: {
    'globalThis.__FEATURE_SNIP_COMPACT__': 'true',
    'globalThis.__FEATURE_CACHED_MICROCOMPACT__': 'true',
    'globalThis.__FEATURE_CONTEXT_COLLAPSE__': 'true',
    'globalThis.__FEATURE_REACTIVE_COMPACT__': 'true',
    'globalThis.__FEATURE_PROMPT_CACHING__': 'true',
    'globalThis.__FEATURE_STREAMING_TOOL_DISCARD__': 'true',
    'globalThis.__FEATURE_MAX_OUTPUT_RECOVERY__': 'true',
    'globalThis.__FEATURE_PROVIDER_FALLBACK__': 'true',
    'globalThis.__FEATURE_ATTACHMENT_SYSTEM__': 'true',
    'globalThis.__FEATURE_MEMORY_PREFETCH__': 'true',
    'globalThis.__FEATURE_TELEMETRY_EVENTS__': 'true',
    'globalThis.__FEATURE_STRUCTURED_OUTPUT__': 'true',
    'globalThis.__FEATURE_MEDIA_ERROR_RECOVERY__': 'true',
    'globalThis.__FEATURE_SLASH_COMMANDS_IN_LOOP__': 'true',
  },
})
