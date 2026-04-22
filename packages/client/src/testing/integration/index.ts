/**
 * Integration-test harness — public entry for `@cqrs-toolkit/client/testing`.
 *
 * Re-exports the bootstrap functions that wire a complete CQRS client (both
 * the raw internals and a {@link CqrsClient} built on top of them) plus the
 * run helpers, test options, mock sender, and variant matrix so consumers
 * (including sibling packages like `@cqrs-toolkit/client-solid`) can write
 * integration tests without reinventing the bootstrap mechanics.
 */

export {
  bootstrapOnlineOnly,
  bootstrapWorkerSide,
  buildIntegrationClient,
  type BootstrapFn,
  type IntegrationBootstrapConfig,
  type IntegrationContext,
} from './bootstrap.js'
export {
  TODO_SCOPE_KEY,
  createTodoHandler,
  createTodosCollection,
  rejectingHandler,
  todoCreatedProcessor,
  todoUpdatedProcessor,
  updateTodoHandler,
  type TodoCreatedEvent,
  type TodoRow,
  type TodoUpdatedEvent,
} from './fixtures.js'
export { createMockCommandSender, type MockCommandSender } from './mock-command-sender.js'
export {
  TestSyncManager,
  bootstrapVariants,
  createRun,
  integrationTestOptions,
  type TestContext,
} from './test-helpers.js'
