/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'unit-schema',
    environment: 'node',
    includeSource: ['src/*.test.ts', 'src/**/*.test.ts'],
  },
})
