/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'unit-client-electron',
    environment: 'node',
    includeSource: ['src/*.test.ts', 'src/**/*.test.ts'],
  },
})
