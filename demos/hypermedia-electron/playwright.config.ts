import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'src/tests',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    launchOptions: {
      args: ['--headless=new'],
    },
  },
  webServer: {
    command: 'npm run server',
    port: 3002,
    reuseExistingServer: true, // !process.env['CI'],
  },
})
