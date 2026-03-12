import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/client/vite.config.ts',
  'packages/client-solid/vite.config.ts',
  'packages/devtools/vite.config.ts',
  'packages/realtime/vite.config.ts',
  'packages/schema/vite.config.ts',
  'demos/todo-demo/vite.server.config.ts',
])
