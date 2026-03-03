/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'unit-realtime',
    environment: 'node',
    includeSource: ['src/*.test.ts', 'src/**/*.test.ts'],
  },
})
