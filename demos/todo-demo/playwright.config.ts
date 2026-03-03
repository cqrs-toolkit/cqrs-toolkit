import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
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
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
