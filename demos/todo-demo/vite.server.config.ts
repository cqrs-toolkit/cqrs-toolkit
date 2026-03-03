/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'unit-todo-demo-server',
    environment: 'node',
    includeSource: ['server/**/*.test.ts'],
  },
})
