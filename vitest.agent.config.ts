import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/agent/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
