import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/realtime/vite.config.ts',
  'packages/client/vite.config.ts',
  'packages/client-solid/vite.config.ts',
  'demos/todo-demo/vite.server.config.ts',
])
