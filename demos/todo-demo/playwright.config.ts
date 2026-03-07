import type { ExecutionMode } from '@cqrs-toolkit/client'
import { defineConfig } from '@playwright/test'

interface ModeFixtures {
  mode: ExecutionMode
}

export default defineConfig<ModeFixtures>({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  testIgnore: 'tests/extension/**',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: [
    {
      command: 'npm run server',
      port: 3001,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'npm run client',
      port: 5173,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'npm run client:peer',
      port: 5174,
      reuseExistingServer: !process.env['CI'],
    },
  ],
  projects: [
    {
      name: 'online-only',
      use: { browserName: 'chromium', mode: 'online-only' },
    },
    {
      name: 'dedicated-worker',
      use: { browserName: 'chromium', mode: 'dedicated-worker' },
    },
    {
      name: 'shared-worker',
      use: { browserName: 'chromium', mode: 'shared-worker' },
    },
  ],
})
