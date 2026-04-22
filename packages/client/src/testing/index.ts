/**
 * Testing utilities exports. Public entry for `@cqrs-toolkit/client/testing`.
 */

export * from './aggregates.js'
export { createTestStorage } from './createTestStorage.js'
export type { CreateTestStorageOptions } from './createTestStorage.js'
export { createTestWriteQueue } from './createTestWriteQueue.js'
export { marbleTest } from './marbleTest.js'
export { testEventBusLogger } from './testLogger.js'

// Integration-test harness: bootstrap variants, CqrsClient builder, run helper,
// TestSyncManager, etc. See ./integration/index.ts for the full surface.
export * from './integration/index.js'
