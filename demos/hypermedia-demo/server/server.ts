/**
 * Demo server entrypoint.
 *
 * Run with: npm run server -w @cqrs-toolkit/hypermedia-demo
 */

import { createApp } from './bootstrap.js'

const { app } = createApp()

try {
  await app.listen({ port: 3002, host: '0.0.0.0' })
  console.log('Hypermedia demo server running on http://localhost:3002')
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
