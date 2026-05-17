/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'unit-hypermedia-base',
    environment: 'node',
    includeSource: ['src/**/*.test.ts'],
  },
})
