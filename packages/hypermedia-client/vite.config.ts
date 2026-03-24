/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'unit-hm-client',
    includeSource: ['src/*.test.ts', 'src/**/*.test.ts'],
  },
})
