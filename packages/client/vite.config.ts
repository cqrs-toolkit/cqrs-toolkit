/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'unit-cqrs-client',
    environment: 'jsdom',
    setupFiles: ['src/vitest-setup.ts'],
    includeSource: ['src/*.test.ts', 'src/**/*.test.ts'],
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
})
