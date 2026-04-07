import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'packages/client/vite.config.ts',
      'packages/client-solid/vite.config.ts',
      'packages/client-electron/vite.config.ts',
      'packages/devtools/vite.config.ts',
      'packages/hypermedia/vite.config.ts',
      'packages/realtime/vite.config.ts',
      'packages/schema/vite.config.ts',
      'packages/hypermedia-client/vite.config.ts',
      'demos/todo-demo/vite.server.config.ts',
      'demos/hypermedia-server/vite.server.config.ts',
    ],
  },
})
