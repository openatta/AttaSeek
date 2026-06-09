import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/unit/**/*.{test,spec}.{ts,tsx}', 'test/agent/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/main/**/*.ts', 'src/renderer/**/*.{ts,tsx}', 'src/shared/**/*.ts'],
      exclude: [
        'src/renderer/main.tsx',
        'src/renderer/**/*.d.ts',
        'src/main/**/*.d.ts',
        'src/preload/**',
        'src/shared/**/*.d.ts'
      ],
      thresholds: {
        lines: 30,
        functions: 25,
        branches: 20,
        statements: 30
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer')
    }
  }
})
