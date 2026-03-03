/**
 * Demo server entrypoint.
 *
 * Run with: npm run server -w @cqrs-toolkit/todo-demo
 */

import { createApp } from './bootstrap.js'

const { app } = createApp()

try {
  await app.listen({ port: 3001, host: '0.0.0.0' })
  console.log('Demo server running on http://localhost:3001')
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
