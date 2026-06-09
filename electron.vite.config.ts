import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Feature-flag defines for compile-time dead-code elimination.
// When a flag is `false` at build time, Terser eliminates the guarded code block.
// All flags default to `true` in dev; production builds may set internal-only
// flags to `false` to reduce bundle size and ensure they don't ship externally.
const featureDefines = {
  __FEATURE_SNIP_COMPACT__: 'true',
  __FEATURE_CACHED_MICROCOMPACT__: 'true',
  __FEATURE_CONTEXT_COLLAPSE__: 'true',
  __FEATURE_REACTIVE_COMPACT__: 'true',
  __FEATURE_PROMPT_CACHING__: 'true',
  __FEATURE_STREAMING_TOOL_DISCARD__: 'true',
  __FEATURE_MAX_OUTPUT_RECOVERY__: 'true',
  __FEATURE_PROVIDER_FALLBACK__: 'true',
  __FEATURE_ATTACHMENT_SYSTEM__: 'true',
  __FEATURE_MEMORY_PREFETCH__: 'true',
  __FEATURE_TELEMETRY_EVENTS__: 'true',
  __FEATURE_STRUCTURED_OUTPUT__: 'true',
  __FEATURE_MEDIA_ERROR_RECOVERY__: 'true',
  __FEATURE_SLASH_COMMANDS_IN_LOOP__: 'true',
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['better-sqlite3'] })],
    build: {
      rollupOptions: {
        external: ['better-sqlite3']
      },
    },
    define: {
      ...Object.fromEntries(
        Object.entries(featureDefines).map(([k, v]) => [`globalThis.${k}`, JSON.stringify(v === 'true')]),
      ),
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
