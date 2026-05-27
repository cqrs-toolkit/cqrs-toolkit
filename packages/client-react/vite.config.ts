/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'unit-client-react',
    environment: 'jsdom',
    setupFiles: ['src/vitest-setup.ts'],
    includeSource: ['src/*.test.ts', 'src/**/*.test.ts', 'src/*.test.tsx', 'src/**/*.test.tsx'],
  },
})
