/**
 * Dedicated Worker adapter exports (Mode C).
 */

export { DedicatedWorkerAdapter, TabLockError } from './DedicatedWorkerAdapter.js'
export type { DedicatedWorkerAdapterConfig } from './DedicatedWorkerAdapter.js'
export { DedicatedWorkerStorageProxy } from './DedicatedWorkerStorageProxy.js'

// Note: worker.ts is a separate entry point and should not be imported here
