import type { ExecutionMode } from '@cqrs-toolkit/client'
import { defineConfig } from '@playwright/test'

interface ModeFixtures {
  mode: ExecutionMode
}

export default defineConfig<ModeFixtures>({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5175',
  },
  webServer: [
    {
      command: 'npm run server',
      port: 3002,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'npm run client',
      port: 5175,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'npm run client:peer',
      port: 5176,
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
